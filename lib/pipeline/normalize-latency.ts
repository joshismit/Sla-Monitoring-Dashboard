/**
 * lib/pipeline/normalize-latency.ts
 *
 * Stage 4: Coerce raw latency strings to `number | null`.
 *
 * Rules:
 *   - Strip trailing "ms" suffix (case-insensitive) and whitespace.
 *   - Parse as float.
 *   - Negative values    → _latencyRejected: true  + severity:'error'  (row must be rejected)
 *   - Non-numeric strings → null + severity:'warning'  (data present but unparseable)
 *   - Absent / empty string → null  (column is optional; no issue logged)
 *
 * Note: latency = 0 is valid. Only strictly negative values are rejected.
 * Missing latency is never a rejection — the field is optional.
 */

import type { RawRow, RowIssue } from "./types";

export interface LatencyNormalizedRow extends RawRow {
  _latencyParsed: number | null;
  /**
   * true only when the latency value was present but negative.
   * Absent latency leaves this false — missing is not an error.
   */
  _latencyRejected: boolean;
}

export interface LatencyNormalizationResult<TRow extends RawRow> {
  rows: (TRow & LatencyNormalizedRow)[];
  issues: RowIssue[];
}

export function normalizeLatency<TRow extends RawRow>(
  rows: TRow[]
): LatencyNormalizationResult<TRow> {
  const issues: RowIssue[] = [];
  const normalized: (TRow & LatencyNormalizedRow)[] = [];

  for (const row of rows) {
    const raw = row.latencyMs ?? "";

    if (raw === "") {
      // Optional field — silently treat as null
      normalized.push({ ...row, _latencyParsed: null } as TRow & LatencyNormalizedRow);
      continue;
    }

    // Strip "ms" suffix (case-insensitive) and surrounding whitespace
    const stripped = raw.replace(/ms$/i, "").trim();

    if (stripped === "") {
      // Was literally just "ms" with no numeric part
      issues.push({
        rowIndex: row.rowIndex,
        field: "latencyMs",
        message: `Latency value "${raw}" has no numeric component`,
        severity: "warning",
      });
      normalized.push({ ...row, _latencyParsed: null } as TRow & LatencyNormalizedRow);
      continue;
    }

    const parsed = parseFloat(stripped);

    if (isNaN(parsed)) {
      issues.push({
        rowIndex: row.rowIndex,
        field: "latencyMs",
        message: `Cannot parse latency value: "${raw}"`,
        severity: "warning",
      });
      normalized.push({ ...row, _latencyParsed: null } as TRow & LatencyNormalizedRow);
      continue;
    }

    if (parsed < 0) {
      // Negative latency is invalid data — reject the row (NEGATIVE_LATENCY).
      // Zero is valid; only strictly < 0 is rejected.
      issues.push({
        rowIndex: row.rowIndex,
        field: "latencyMs",
        message: `NEGATIVE_LATENCY: latency must be ≥ 0, got ${parsed}ms`,
        severity: "error",
      });
      normalized.push({
        ...row,
        _latencyParsed: null,
        _latencyRejected: true,
      } as TRow & LatencyNormalizedRow);
      continue;
    }

    normalized.push({
      ...row,
      _latencyParsed: parsed,
      _latencyRejected: false,
    } as TRow & LatencyNormalizedRow);
  }

  return { rows: normalized, issues };
}
