/**
 * lib/pipeline/validate-status.ts
 *
 * Stage 5: Validate HTTP status codes and derive `isAvailable`.
 *
 * Rules:
 *   - statusCode must be a whole integer in [100, 599].
 *   - Out-of-range or non-integer → row flagged as error.
 *   - `isAvailable` is derived as statusCode ∈ [200, 299].
 *   - If the CSV includes a raw `isAvailable` column it is parsed as boolean
 *     and used directly; a mismatch with the derived value is a warning.
 */

import type { RawRow, RowIssue } from "./types";

export interface StatusValidatedRow extends RawRow {
  _statusCodeParsed: number | null;
  _isAvailableParsed: boolean | null;
}

export interface StatusValidationResult {
  rows: StatusValidatedRow[];
  issues: RowIssue[];
}

const TRUTHY_VALUES = new Set(["true", "1", "yes", "y", "on"]);
const FALSY_VALUES = new Set(["false", "0", "no", "n", "off"]);

function parseBoolean(raw: string): boolean | null {
  const lower = raw.trim().toLowerCase();
  if (TRUTHY_VALUES.has(lower)) return true;
  if (FALSY_VALUES.has(lower)) return false;
  return null;
}

export function validateStatus(rows: RawRow[]): StatusValidationResult {
  const issues: RowIssue[] = [];
  const validated: StatusValidatedRow[] = [];

  for (const row of rows) {
    const rawStatus = row.statusCode ?? "";

    // --- Parse statusCode ---
    let statusCodeParsed: number | null = null;

    if (rawStatus === "") {
      issues.push({
        rowIndex: row.rowIndex,
        field: "statusCode",
        message: "statusCode is missing",
        severity: "error",
      });
    } else {
      const n = Number(rawStatus);
      const isWholeNumber = Number.isInteger(n);

      if (isNaN(n) || !isWholeNumber) {
        issues.push({
          rowIndex: row.rowIndex,
          field: "statusCode",
          message: `statusCode "${rawStatus}" is not a whole integer`,
          severity: "error",
        });
      } else if (n < 100 || n > 599) {
        issues.push({
          rowIndex: row.rowIndex,
          field: "statusCode",
          message: `statusCode ${n} is outside the valid HTTP range [100, 599]`,
          severity: "error",
        });
      } else {
        statusCodeParsed = n;
      }
    }

    // --- Derive / parse isAvailable ---
    const derivedAvailable =
      statusCodeParsed !== null
        ? statusCodeParsed >= 200 && statusCodeParsed <= 299
        : null;

    let isAvailableParsed: boolean | null = derivedAvailable;

    const rawAvailable = row.isAvailable ?? "";
    if (rawAvailable !== "") {
      const explicit = parseBoolean(rawAvailable);
      if (explicit === null) {
        issues.push({
          rowIndex: row.rowIndex,
          field: "isAvailable",
          message: `Cannot parse isAvailable value: "${rawAvailable}" — falling back to statusCode derivation`,
          severity: "warning",
        });
      } else {
        // Use explicit value; warn if it contradicts the derived one.
        if (derivedAvailable !== null && explicit !== derivedAvailable) {
          issues.push({
            rowIndex: row.rowIndex,
            field: "isAvailable",
            message:
              `isAvailable="${rawAvailable}" contradicts statusCode=${statusCodeParsed} ` +
              `(derived: ${derivedAvailable}). Using explicit value.`,
            severity: "warning",
          });
        }
        isAvailableParsed = explicit;
      }
    }

    validated.push({
      ...row,
      _statusCodeParsed: statusCodeParsed,
      _isAvailableParsed: isAvailableParsed,
    });
  }

  return { rows: validated, issues };
}
