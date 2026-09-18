/**
 * lib/pipeline/validate-record.ts
 *
 * Stage 6: Full record validation using Zod.
 *
 * At this point each row has already been through:
 *   - column mapping      → RawRow fields populated
 *   - timestamp parsing   → _timestampParsed: Date | null
 *   - latency parsing     → _latencyParsed: number | null
 *   - status validation   → _statusCodeParsed: number | null
 *                         → _isAvailableParsed: boolean | null
 *
 * This stage assembles a `HealthCheckRecord` from those pre-parsed values,
 * validates required fields are present, and rejects the row if any
 * required field is still null/empty.
 */

import { z } from "zod";
import type { RowIssue } from "./types";
import type { HealthCheckRecord } from "./types";
import type { TimestampNormalizedRow } from "./normalize-timestamps";
import type { LatencyNormalizedRow } from "./normalize-latency";
import type { StatusValidatedRow } from "./validate-status";

/** The fully pre-processed row shape entering this stage. */
export type PreValidatedRow = TimestampNormalizedRow &
  LatencyNormalizedRow &
  StatusValidatedRow;

// ---------------------------------------------------------------------------
// Zod schema — validates the string fields that haven't been pre-parsed yet.
// ---------------------------------------------------------------------------
const requiredString = z.string().min(1, "Required field is empty or missing");

const RecordSchema = z.object({
  serviceId: requiredString,
  serviceName: requiredString,
  agent: requiredString,
  region: requiredString,
});

// ---------------------------------------------------------------------------

export interface RecordValidationResult {
  records: HealthCheckRecord[];
  issues: RowIssue[];
  /** rowIndex values that were rejected (had at least one error-severity issue) */
  rejectedRowIndices: Set<number>;
}

export function validateRecord(
  rows: PreValidatedRow[]
): RecordValidationResult {
  const issues: RowIssue[] = [];
  const rejectedRowIndices = new Set<number>();
  const records: HealthCheckRecord[] = [];

  for (const row of rows) {
    const rowErrors: RowIssue[] = [];

    // --- Check pre-parsed required fields ---
    if (row._timestampParsed === null) {
      // Error already logged in normalizeTimestamps; mark for rejection.
      rowErrors.push({
        rowIndex: row.rowIndex,
        field: "timestampUtc",
        message: "Row rejected: timestamp could not be parsed",
        severity: "error",
      });
    }

    if (row._latencyRejected) {
      // Error already logged in normalizeLatency (NEGATIVE_LATENCY).
      // latency = 0 is valid; missing latency is never a rejection.
      rowErrors.push({
        rowIndex: row.rowIndex,
        field: "latencyMs",
        message: "Row rejected: latency is negative",
        severity: "error",
      });
    }

    if (row._statusCodeParsed === null) {
      rowErrors.push({
        rowIndex: row.rowIndex,
        field: "statusCode",
        message: "Row rejected: statusCode is invalid or missing",
        severity: "error",
      });
    }

    if (row._isAvailableParsed === null) {
      rowErrors.push({
        rowIndex: row.rowIndex,
        field: "isAvailable",
        message: "Row rejected: isAvailable could not be determined",
        severity: "error",
      });
    }

    // --- Zod validation for string fields ---
    const zodResult = RecordSchema.safeParse({
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      agent: row.agent,
      region: row.region,
    });

    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        const field = String(issue.path[0] ?? "unknown");
        rowErrors.push({
          rowIndex: row.rowIndex,
          field,
          message: issue.message,
          severity: "error",
        });
      }
    }

    if (rowErrors.length > 0) {
      issues.push(...rowErrors);
      rejectedRowIndices.add(row.rowIndex);
      continue;
    }

    // Safe to assemble — all fields are guaranteed non-null at this point.
    records.push({
      serviceId: row.serviceId!,
      serviceName: row.serviceName!,
      timestampUtc: row._timestampParsed!,
      statusCode: row._statusCodeParsed!,
      latencyMs: row._latencyParsed,
      agent: row.agent!,
      region: row.region!,
      isAvailable: row._isAvailableParsed!,
    });
  }

  return { records, issues, rejectedRowIndices };
}
