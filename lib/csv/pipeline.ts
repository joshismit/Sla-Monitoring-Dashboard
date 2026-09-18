/**
 * lib/csv/pipeline.ts
 *
 * Orchestrates the full CSV ingestion pipeline using only lib/csv/* modules.
 *
 * Stage order:
 *   parseCsv           → RawHealthCheck[]           (structural parse + column mapping)
 *   validateRequired   → rejects rows missing fields (fast-fail before normalisation)
 *   normalizeTimestamp → Date (UTC)                  ← must precede deduplication
 *   normalizeLatency   → number | null (ms)
 *   normalizeStatus    → number in [100, 599]
 *   validateLatency    → guards against negative after normalisation
 *   isAvailable        → boolean derived from statusCode
 *   deduplicate        → composite key: (serviceId, timestampUtc, agent, region)
 *   deriveDateRange    → min/max from accepted records
 *
 * Why normalisation precedes deduplication:
 *   "2025-05-09T14:30:00Z" and "2025-05-09T20:00:00+05:30" are the same UTC
 *   instant. String comparison produces two records; Date comparison produces
 *   one. Normalise first, then deduplicate — never the other way round.
 *
 * No Prisma. No database. No API. No React.
 */

import { parseCsv, CsvParseError } from "./parser";
import { normalizeTimestamp, normalizeLatency, normalizeStatus } from "./normalizers";
import { ValidationError, validateRequiredFields, validateLatency } from "./validators";
import { isAvailable } from "./availability";
import { deriveDateRange } from "./derive-date-range";
import type {
  RawHealthCheck,
  CleanHealthCheck,
  RejectedRecord,
  RejectionReason,
  PipelineResult,
  PipelineSummary,
} from "./types";

export { CsvParseError };

// ---------------------------------------------------------------------------
// Deduplication key
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic composite key for a CleanHealthCheck.
 *
 * Identity: (serviceId, timestampUtc ISO string, agent, region)
 * Delimiter: null byte (\x00) — cannot appear in any field value, so
 * "svc|east" + "bot" never collides with "svc" + "east|bot".
 */
function getRecordKey(record: CleanHealthCheck): string {
  return [
    record.serviceId,
    record.timestampUtc.toISOString(),
    record.agent,
    record.region,
  ].join("\x00");
}

// ---------------------------------------------------------------------------
// Row-level processing
// ---------------------------------------------------------------------------

/**
 * Attempt to normalise and validate a single RawHealthCheck.
 * Returns a CleanHealthCheck on success, throws a ValidationError on failure.
 */
function processRow(raw: RawHealthCheck): CleanHealthCheck {
  // Validate required string fields first — fail fast before any normalisation
  // attempt so the rejection reason is MISSING_REQUIRED_FIELD, not a misleading
  // INVALID_TIMESTAMP or INVALID_STATUS on an empty string.
  validateRequiredFields(raw);

  const timestampUtc = normalizeTimestamp(raw.timestamp);
  const latencyMs    = normalizeLatency(raw.latency, raw.latencyUnit);
  const statusCode   = normalizeStatus(raw.statusCode);

  // Belt-and-suspenders: normalizeLatency already rejects negatives, but
  // calling validateLatency explicitly makes the contract explicit here.
  validateLatency(latencyMs);

  return {
    serviceId:    raw.serviceId,
    serviceName:  raw.serviceName,
    timestampUtc,
    statusCode,
    latencyMs,
    agent:        raw.agent,
    region:       raw.region,
    isAvailable:  isAvailable(statusCode),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Process a CSV string through the full ingestion pipeline.
 *
 * @param csvText - Raw UTF-8 CSV content.
 * @returns PipelineResult with clean records, rejected rows, and a summary.
 * @throws {CsvParseError} If the file is structurally invalid (empty, no headers,
 *   missing required columns). Row-level errors are captured in `rejected`, not thrown.
 */
export function processCsv(csvText: string): PipelineResult {
  // --- Stage 1: Parse ---
  // CsvParseError is a structural failure (bad file) — propagate to the caller.
  const rawRecords = parseCsv(csvText);
  const totalRows = rawRecords.length;

  // --- Stages 2–6: Per-row normalisation + validation ---
  const accepted: CleanHealthCheck[] = [];
  const rejected: RejectedRecord[]   = [];

  for (const raw of rawRecords) {
    try {
      accepted.push(processRow(raw));
    } catch (error) {
      if (error instanceof ValidationError) {
        rejected.push({
          rowNumber: raw.rowNumber,
          reason:    error.reason,
          details:   error.details,
        });
      } else {
        // Unexpected error (e.g. a bug) — record it rather than crashing.
        rejected.push({
          rowNumber: raw.rowNumber,
          reason:    "MISSING_REQUIRED_FIELD" as RejectionReason,
          details:   error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // --- Stage 7: Deduplication ---
  // Runs AFTER timestamp normalisation so timezone-equivalent timestamps
  // ("14:30Z" and "20:00+05:30") collapse to the same key.
  const seen = new Set<string>();
  const uniqueRecords: CleanHealthCheck[] = [];
  let duplicateRows = 0;

  for (const record of accepted) {
    const key = getRecordKey(record);
    if (seen.has(key)) {
      duplicateRows++;
    } else {
      seen.add(key);
      uniqueRecords.push(record);
    }
  }

  // --- Assemble summary ---
  const rejectionReasons: Record<string, number> = {};
  for (const r of rejected) {
    rejectionReasons[r.reason] = (rejectionReasons[r.reason] ?? 0) + 1;
  }

  const summary: PipelineSummary = {
    totalRows,
    acceptedRows:  uniqueRecords.length,
    rejectedRows:  rejected.length,
    duplicateRows,
    rejectionReasons,
    // Derived from the accepted records — never hardcoded.
    dateRange: deriveDateRange(uniqueRecords),
  };

  return {
    records:  uniqueRecords,
    rejected,
    summary,
  };
}
