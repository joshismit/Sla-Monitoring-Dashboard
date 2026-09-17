/**
 * lib/csv/types.ts
 *
 * Canonical type definitions for the CSV ingestion pipeline.
 *
 * The boundary contract is:
 *
 *   Raw CSV bytes
 *     → column mapping  → RawHealthCheck      (all strings, units separated)
 *     → normalisation   → CleanHealthCheck     (typed, UTC, derived fields)
 *
 * Nothing outside lib/csv/ or lib/pipeline/ should ever touch a raw string
 * field from the CSV directly — always use CleanHealthCheck downstream.
 *
 * No Prisma. No database. No API. No React.
 */

// ---------------------------------------------------------------------------
// 1. Intermediate record — post column-mapping, pre-normalisation.
//
//    Every value is still a string (or null when the column was absent).
//    Latency is split into its numeric part and its unit so normalisation
//    can handle each independently and report errors precisely.
//
//    Field names correspond to the *canonical* names after alias resolution
//    (see lib/pipeline/map-columns.ts), not necessarily the raw CSV headers.
// ---------------------------------------------------------------------------

export interface RawHealthCheck {
  /**
   * 1-based row number as it would appear in a spreadsheet
   * (header = row 1, first data row = row 2).
   * Assigned by parseCsv() and carried through every pipeline stage
   * so RejectedRecord.rowNumber is always traceable to the source file.
   */
  rowNumber: number;
  /** e.g. "svc-api-gateway", "d4e5f6" */
  serviceId: string;
  /** Human-readable display name, e.g. "API Gateway" */
  serviceName: string;
  /**
   * Raw timestamp string exactly as it appeared in the CSV.
   * May be ISO 8601, space-separated, Unix epoch seconds/ms, etc.
   * Normalised to a UTC Date by the timestamp stage.
   */
  timestamp: string;
  /**
   * Raw HTTP status code string, e.g. "200", "503".
   * Validated to be a whole integer in [100, 599] by the status stage.
   */
  statusCode: string;
  /**
   * The numeric portion of the latency value, e.g. "142", "3.7".
   * null when the latency column was absent or empty.
   */
  latency: string | null;
  /**
   * The unit suffix found alongside the latency value, e.g. "ms", "s".
   * null when absent or when the latency column itself was absent.
   * Used by the latency normaliser to convert to milliseconds.
   */
  latencyUnit: string | null;
  /** Monitoring agent identifier, e.g. "bot-a", "synthetic-us" */
  agent: string;
  /** Geographic/logical region, e.g. "us-east-1", "eu-west" */
  region: string;
}

// ---------------------------------------------------------------------------
// 2. Clean record — the final, fully normalised output.
//
//    All fields are typed; strings are trimmed and validated; dates are UTC;
//    isAvailable is derived from statusCode (or overridden by an explicit
//    CSV column if present).
//
//    This is the only shape that should cross the pipeline boundary.
//    Mirrors the Prisma HealthCheck model's CSV-sourced fields exactly
//    (DB-only fields id, uploadRunId, createdAt are added at insert time).
// ---------------------------------------------------------------------------

export interface CleanHealthCheck {
  serviceId: string;
  serviceName: string;
  /** Always UTC. */
  timestampUtc: Date;
  /** Validated whole integer in [100, 599]. */
  statusCode: number;
  /**
   * Always in milliseconds.
   * null when the CSV value was absent, empty, non-numeric, or negative.
   */
  latencyMs: number | null;
  agent: string;
  region: string;
  /** Derived: statusCode ∈ [200, 299], or parsed from an explicit CSV column. */
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// 3. Rejection tracking — typed reason codes + per-row detail.
// ---------------------------------------------------------------------------

/**
 * Machine-readable codes for why a row was rejected.
 * Used in RejectedRecord and aggregated in PipelineSummary.rejectionReasons.
 */
export type RejectionReason =
  | "INVALID_TIMESTAMP"   // timestamp string could not be parsed
  | "INVALID_STATUS"      // statusCode missing, non-integer, or out of [100,599]
  | "NEGATIVE_LATENCY"    // latency was parseable but < 0
  | "INVALID_LATENCY"     // latency string was present but non-numeric
  | "MISSING_REQUIRED_FIELD"; // serviceId, serviceName, agent, or region was empty

export interface RejectedRecord {
  /**
   * 1-based row number as it would appear in a spreadsheet
   * (header = row 1, first data row = row 2).
   */
  rowNumber: number;
  reason: RejectionReason;
  /** Optional human-readable detail, e.g. the offending value. */
  details?: string;
}

// ---------------------------------------------------------------------------
// 4. Summary & top-level result
// ---------------------------------------------------------------------------

/**
 * The temporal extent of the accepted dataset.
 * Derived from CleanHealthCheck.timestampUtc — never hardcoded.
 */
export interface DateRange {
  /** Earliest timestampUtc across all accepted records. */
  min: Date;
  /** Latest timestampUtc across all accepted records. */
  max: Date;
}

export interface PipelineSummary {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  /**
   * Count of rejections broken down by RejectionReason code.
   * Keys are RejectionReason strings; value is the occurrence count.
   * e.g. { "INVALID_TIMESTAMP": 3, "MISSING_REQUIRED_FIELD": 1 }
   */
  rejectionReasons: Record<string, number>;
  /**
   * Temporal extent of the accepted dataset — derived from the data,
   * never hardcoded.
   * null when acceptedRows === 0 (nothing to derive from).
   */
  dateRange: DateRange | null;
}

export interface PipelineResult {
  records: CleanHealthCheck[];
  rejected: RejectedRecord[];
  summary: PipelineSummary;
}
