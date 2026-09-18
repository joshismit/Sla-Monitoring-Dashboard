/**
 * lib/pipeline/index.ts
 *
 * Public entry point for the CSV processing pipeline.
 *
 * Stage order (and why it matters):
 *   1. parseCSV            — raw bytes → string[][]
 *   2. mapColumns          — string[][] → RawRow[] (canonical field names)
 *   3. normalizeTimestamps — raw string → Date (UTC instant)        ← must come BEFORE step 7
 *   4. normalizeLatency    — raw string → number | null (ms)
 *   5. validateStatus      — raw string → number, derives isAvailable
 *   6. validateRecord      — assembles HealthCheckRecord, rejects invalid rows
 *   7. deduplicateRecords  — removes records with the same composite key
 *
 * Why normaliseTimestamp (step 3) must precede deduplicateRecords (step 7):
 *
 *   The deduplication key includes the timestamp:
 *     key = [serviceId, timestampUtc.toISOString(), agent, region].join("\x00")
 *
 *   Two CSV rows can represent the same instant with different raw strings:
 *     "2025-05-09T14:30:00Z"        (UTC)
 *     "2025-05-09T20:00:00+05:30"   (IST — same instant, different string)
 *
 *   String comparison: different → two records survive deduplication. ❌
 *   Date comparison:   same      → one record survives deduplication.  ✅
 *
 *   Without normalisation first, the pipeline would produce phantom duplicates
 *   whenever two monitoring agents report the same check in different timezones.
 *
 * Returns a `PipelineResult` with clean records and a data-quality summary.
 * No Prisma. No database. No API. No React.
 */

import { parseCSV } from "./parse-csv";
import { mapColumns } from "./map-columns";
import { normalizeTimestamps } from "./normalize-timestamps";
import { normalizeLatency } from "./normalize-latency";
import { validateStatus } from "./validate-status";
import { validateRecord, type PreValidatedRow } from "./validate-record";
import { deduplicateRecords } from "./deduplicate";
import { deriveDateRange } from "../csv/derive-date-range";
import type { PipelineResult, RowIssue, RawRow } from "./types";

export type { PipelineResult, HealthCheckRecord, DataQualitySummary, RowIssue } from "./types";

/**
 * Run the full CSV → HealthCheckRecord[] pipeline.
 *
 * @param input - Raw CSV text or Buffer.
 * @returns `PipelineResult` containing clean records and a quality summary.
 * @throws If the CSV cannot be parsed at all (malformed structure).
 */
export function runPipeline(input: string | Buffer): PipelineResult {
  const allIssues: RowIssue[] = [];

  // -------------------------------------------------------------------------
  // Stage 1: Parse CSV
  // -------------------------------------------------------------------------
  const parsed = parseCSV(input);
  const totalRows = parsed.rows.length;

  // -------------------------------------------------------------------------
  // Stage 2: Column mapping
  // -------------------------------------------------------------------------
  const { rows: rawRows, unknownColumns } = mapColumns(parsed);

  // Log unknown columns as row-agnostic warnings (rowIndex = -1)
  for (const col of unknownColumns) {
    allIssues.push({
      rowIndex: -1,
      field: col,
      message: `Unknown column "${col}" — ignored`,
      severity: "warning",
    });
  }

  // -------------------------------------------------------------------------
  // Stage 3: Timestamp normalisation
  // -------------------------------------------------------------------------
  const { rows: tsRows, issues: tsIssues } = normalizeTimestamps(rawRows);
  allIssues.push(...tsIssues);

  // -------------------------------------------------------------------------
  // Stage 4: Latency normalisation
  // -------------------------------------------------------------------------
  const { rows: latRows, issues: latIssues } = normalizeLatency(tsRows as RawRow[]);
  allIssues.push(...latIssues);

  // -------------------------------------------------------------------------
  // Stage 5: Status validation
  // -------------------------------------------------------------------------
  const { rows: statusRows, issues: statusIssues } = validateStatus(latRows as RawRow[]);
  allIssues.push(...statusIssues);

  // -------------------------------------------------------------------------
  // Stage 6: Record validation (Zod + required-field checks)
  // -------------------------------------------------------------------------
  const preValidated = statusRows as PreValidatedRow[];
  const {
    records: validRecords,
    issues: recordIssues,
    rejectedRowIndices,
  } = validateRecord(preValidated);
  allIssues.push(...recordIssues);

  // Build parallel rowIndex array for deduplication reporting
  const validRowIndices = preValidated
    .filter((r) => !rejectedRowIndices.has(r.rowIndex))
    .map((r) => r.rowIndex);

  // -------------------------------------------------------------------------
  // Stage 7: Duplicate detection
  // -------------------------------------------------------------------------
  const {
    records: uniqueRecords,
    issues: dedupIssues,
    duplicateCount,
  } = deduplicateRecords(validRecords, validRowIndices);
  allIssues.push(...dedupIssues);

  // -------------------------------------------------------------------------
  // Assemble summary
  // -------------------------------------------------------------------------
  const rejectedRows = rejectedRowIndices.size;
  const acceptedRows = uniqueRecords.length;

  return {
    records: uniqueRecords,
    summary: {
      totalRows,
      acceptedRows,
      rejectedRows,
      duplicateRows: duplicateCount,
      issues: allIssues,
      // Derived from the accepted records — never hardcoded.
      dateRange: deriveDateRange(uniqueRecords),
    },
  };
}
