/**
 * lib/pipeline/normalize-timestamps.ts
 *
 * Stage 3: Parse raw timestamp strings into UTC Date objects.
 *
 * Formats attempted in order:
 *   1. ISO 8601 (native Date constructor — handles Z, +HH:mm, etc.)
 *   2. "yyyy-MM-dd HH:mm:ss"       → treated as UTC
 *   3. "yyyy-MM-dd HH:mm:ss.SSS"   → treated as UTC
 *   4. Unix epoch seconds (integer, value < 1e10)
 *   5. Unix epoch milliseconds (integer, value >= 1e10)
 *
 * Rows where the timestamp cannot be parsed are flagged as errors and
 * returned with `timestampUtc: null` so downstream stages can skip them.
 */

import type { RawRow, RowIssue } from "./types";

export interface TimestampNormalizedRow extends RawRow {
  /** null means the timestamp was unparseable; row will be rejected later */
  _timestampParsed: Date | null;
}

// "yyyy-MM-dd HH:mm:ss" or "yyyy-MM-dd HH:mm:ss.SSS" — no timezone = UTC
const DATETIME_SPACE_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

function tryParseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. ISO 8601 — let the JS engine try first (handles Z and offset variants).
  //    We accept it only when the raw string looks like it has a timezone marker
  //    or is a pure date-only ISO string that JS reliably parses as UTC.
  //    For strings like "2024-01-15T10:00:00" (no tz) we fall through to step 2
  //    so we can explicitly treat it as UTC.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // 2 & 3. Space/T-separated datetime, no timezone → UTC
  const m = DATETIME_SPACE_RE.exec(trimmed);
  if (m) {
    const [, y, mo, d, h, min, s, ms = "0"] = m;
    const date = new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(mo, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(min, 10),
        parseInt(s, 10),
        parseInt(ms.padEnd(3, "0").slice(0, 3), 10)
      )
    );
    if (!isNaN(date.getTime())) return date;
  }

  // 4 & 5. Unix epoch (seconds or milliseconds)
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    // Seconds: reasonable range 1970-01-01 to ~2286-11-20 (< 1e10 seconds)
    const ms = n < 1e10 ? n * 1000 : n;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export interface TimestampNormalizationResult {
  rows: TimestampNormalizedRow[];
  issues: RowIssue[];
}

/**
 * Attempts to parse `row.timestampUtc` for every row.
 * Rows with unparseable timestamps are flagged with `severity: 'error'`.
 */
export function normalizeTimestamps(
  rows: RawRow[]
): TimestampNormalizationResult {
  const issues: RowIssue[] = [];
  const normalized: TimestampNormalizedRow[] = [];

  for (const row of rows) {
    const raw = row.timestampUtc ?? "";
    const parsed = tryParseDate(raw);

    if (parsed === null && raw !== "") {
      issues.push({
        rowIndex: row.rowIndex,
        field: "timestampUtc",
        message: `Cannot parse timestamp: "${raw}"`,
        severity: "error",
      });
    } else if (raw === "") {
      issues.push({
        rowIndex: row.rowIndex,
        field: "timestampUtc",
        message: "Timestamp is missing",
        severity: "error",
      });
    }

    normalized.push({ ...row, _timestampParsed: parsed });
  }

  return { rows: normalized, issues };
}
