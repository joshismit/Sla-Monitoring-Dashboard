/**
 * lib/pipeline/types.ts
 *
 * Canonical type definitions for the CSV processing pipeline.
 * No Prisma, no database, no API, no React.
 */

// ---------------------------------------------------------------------------
// Temporal extent — derived from the data, never hardcoded.
// ---------------------------------------------------------------------------
export interface DateRange {
  /** Earliest timestampUtc across all accepted records. */
  min: Date;
  /** Latest timestampUtc across all accepted records. */
  max: Date;
}

// ---------------------------------------------------------------------------
// Output record — mirrors the Prisma HealthCheck model fields that come from
// raw CSV data (no DB-only fields: id, uploadRunId, createdAt).
// ---------------------------------------------------------------------------
export interface HealthCheckRecord {
  serviceId: string;
  serviceName: string;
  /** Normalised to UTC */
  timestampUtc: Date;
  statusCode: number;
  /** null when the CSV value is absent, empty, non-numeric, or negative */
  latencyMs: number | null;
  agent: string;
  region: string;
  /** true when statusCode ∈ [200, 299], or parsed from an explicit CSV column */
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Intermediate row shape after column mapping — every value is still a string.
// ---------------------------------------------------------------------------
export interface RawRow {
  rowIndex: number; // 0-based, excluding the header row
  serviceId?: string;
  serviceName?: string;
  timestampUtc?: string;
  statusCode?: string;
  latencyMs?: string;
  agent?: string;
  region?: string;
  isAvailable?: string;
}

// ---------------------------------------------------------------------------
// Issues / quality reporting
// ---------------------------------------------------------------------------
export type IssueSeverity = "error" | "warning";

export interface RowIssue {
  /** 0-based row index (excluding header) */
  rowIndex: number;
  field: string;
  message: string;
  severity: IssueSeverity;
}

// ---------------------------------------------------------------------------
// Per-stage result wrappers
// ---------------------------------------------------------------------------

export interface ColumnMappingResult {
  rows: RawRow[];
  /** Column names present in the CSV that could not be mapped to any canonical field */
  unknownColumns: string[];
}

// ---------------------------------------------------------------------------
// Final pipeline output
// ---------------------------------------------------------------------------
export interface DataQualitySummary {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  issues: RowIssue[];
  /**
   * Temporal extent of the accepted dataset — derived from the data,
   * never hardcoded. null when acceptedRows === 0.
   */
  dateRange: DateRange | null;
}

export interface PipelineResult {
  records: HealthCheckRecord[];
  summary: DataQualitySummary;
}
