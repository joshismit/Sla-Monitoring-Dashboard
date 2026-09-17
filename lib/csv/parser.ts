/**
 * lib/csv/parser.ts
 *
 * Stage 1 of the pipeline: CSV text → RawHealthCheck[].
 *
 * Responsibilities:
 *   - Parse raw CSV text using csv-parse
 *   - Resolve column headers to canonical field names via alias matching
 *   - Validate that all required columns are present (structural check only)
 *   - Split latency values into their numeric part and unit suffix
 *   - Assign 1-based row numbers traceable back to the source file
 *
 * Explicitly NOT responsible for:
 *   - Calculating isAvailable
 *   - Normalising timestamps (parsing strings → Date)
 *   - Converting latency units (seconds → milliseconds)
 *   - Removing duplicates
 *   - Writing to the database
 */

import { parse } from "csv-parse/sync";
import type { RawHealthCheck } from "./types";

// ---------------------------------------------------------------------------
// Public error type — thrown for structural CSV problems (bad headers, empty
// file). Row-level data errors are reported via RejectedRecord instead.
// ---------------------------------------------------------------------------

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

// ---------------------------------------------------------------------------
// Column alias table
//
// Keys are the canonical RawHealthCheck field names (excluding rowNumber and
// latencyUnit, which are never CSV columns — they are derived by the parser).
// Values are the accepted raw header variants, compared after normalisation.
// ---------------------------------------------------------------------------

type CsvField = keyof Omit<RawHealthCheck, "rowNumber" | "latencyUnit">;

const ALIASES: Record<CsvField, string[]> = {
  serviceId: [
    "service_id",
    "serviceid",
    "id",
    "service",
  ],
  serviceName: [
    "service_name",
    "servicename",
    "name",
    "service_name",
    "display_name",
    "displayname",
  ],
  timestamp: [
    "timestamp_utc",
    "timestamputc",
    "timestamp",
    "time",
    "ts",
    "date",
    "datetime",
    "checked_at",
    "checkedat",
  ],
  statusCode: [
    "status_code",
    "statuscode",
    "status",
    "http_status",
    "httpstatus",
    "http_status_code",
    "response_code",
    "responsecode",
  ],
  latency: [
    "latency_ms",
    "latencyms",
    "latency",
    "response_time",
    "responsetime",
    "response_time_ms",
    "latency_s",
    "response_time_s",
    "duration",
    "duration_ms",
  ],
  agent: [
    "agent",
    "monitor_agent",
    "monitoragent",
    "checker",
    "probe",
    "monitor",
  ],
  region: [
    "region",
    "zone",
    "location",
    "datacenter",
    "data_center",
    "pop",
  ],
};

/** Required fields — the parser rejects the whole file if any are absent. */
const REQUIRED_FIELDS: CsvField[] = [
  "serviceId",
  "serviceName",
  "timestamp",
  "statusCode",
  "agent",
  "region",
];

// latency is optional; its absence produces latency: null, latencyUnit: null.

// ---------------------------------------------------------------------------
// Build a normalised-alias → canonical-field lookup map (module-level, once).
// Normalisation: lowercase + strip all non-alphanumeric characters.
// ---------------------------------------------------------------------------

function normalizeHeaderKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ALIAS_LOOKUP = new Map<string, CsvField>();
for (const [field, aliases] of Object.entries(ALIASES) as [CsvField, string[]][]) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normalizeHeaderKey(alias), field);
  }
}

// ---------------------------------------------------------------------------
// Latency splitting
//
// Given a raw latency cell value (e.g. "142ms", "3.7 s", "500") and the
// original column header (e.g. "latency_ms"), return the numeric string and
// the unit string separately.
//
// Unit inference priority:
//   1. Unit suffix embedded in the cell value  ("142ms"  → "ms")
//   2. Unit suffix implied by the column name  ("latency_ms" → "ms")
//   3. null (the normaliser will default or reject)
// ---------------------------------------------------------------------------

/** Matches a numeric value optionally followed by a known unit. */
const LATENCY_VALUE_RE =
  /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(ms|milliseconds?|millis?|s|sec(?:onds?)?)\s*$/i;

/** Matches a purely numeric value with no unit. */
const NUMERIC_ONLY_RE = /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function splitLatency(
  rawValue: string,
  columnName: string,
): { latency: string | null; latencyUnit: string | null } {
  const trimmed = rawValue.trim();

  if (trimmed === "") {
    return { latency: null, latencyUnit: null };
  }

  // 1. Try to extract an embedded unit from the value itself.
  const valueMatch = LATENCY_VALUE_RE.exec(trimmed);
  if (valueMatch) {
    return {
      latency: valueMatch[1],
      latencyUnit: valueMatch[2].toLowerCase(),
    };
  }

  // 2. Value is purely numeric — infer unit from the column name.
  if (NUMERIC_ONLY_RE.test(trimmed)) {
    const col = columnName.toLowerCase();
    let inferredUnit: string | null = null;
    if (col.endsWith("_ms") || col.includes("milli")) inferredUnit = "ms";
    else if (col.endsWith("_s") || col.includes("sec")) inferredUnit = "s";
    return { latency: trimmed, latencyUnit: inferredUnit };
  }

  // 3. Non-numeric, unrecognised format — pass through raw for the normaliser
  //    to reject with INVALID_LATENCY.
  return { latency: trimmed, latencyUnit: null };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse CSV text into an array of RawHealthCheck records.
 *
 * @param csvText - The full CSV content as a UTF-8 string.
 * @returns One RawHealthCheck per data row, with 1-based rowNumbers.
 * @throws {CsvParseError} If the file is empty or missing required columns.
 */
export function parseCsv(csvText: string): RawHealthCheck[] {
  // --- Step 1: Raw CSV parse ---
  const rows: string[][] = parse(csvText, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // rows with fewer columns than header are allowed
  });

  if (rows.length === 0) {
    throw new CsvParseError("CSV is empty — no rows found.");
  }

  const [headerRow, ...dataRows] = rows;

  if (headerRow.length === 0) {
    throw new CsvParseError("CSV header row is empty.");
  }

  if (dataRows.length === 0) {
    throw new CsvParseError(
      "CSV has a header row but no data rows.",
    );
  }

  // --- Step 2: Resolve headers → canonical field names ---
  // columnMap[i] = canonical field name for column i, or null if unrecognised.
  const columnMap: (CsvField | null)[] = headerRow.map(
    (h) => ALIAS_LOOKUP.get(normalizeHeaderKey(h)) ?? null,
  );

  // Build field → first column index map (used in the row-mapping loop).
  const fieldIndex = new Map<CsvField, number>();
  columnMap.forEach((field, i) => {
    if (field !== null && !fieldIndex.has(field)) {
      fieldIndex.set(field, i);
    }
  });

  // --- Step 3: Validate required columns ---
  const missing = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new CsvParseError(
      `CSV is missing required column(s): ${missing.join(", ")}.\n` +
        `Recognised headers: ${headerRow.join(", ")}`,
    );
  }

  // --- Step 4: Locate the latency column (optional) ---
  const latencyColIndex = fieldIndex.get("latency") ?? -1;
  const latencyColName =
    latencyColIndex >= 0 ? headerRow[latencyColIndex] : "";

  // --- Step 5: Map each data row to RawHealthCheck ---
  /** Safely read a cell by canonical field name, returning "" if absent. */
  const cell = (cells: string[], field: CsvField): string => {
    const idx = fieldIndex.get(field);
    return idx !== undefined ? (cells[idx] ?? "") : "";
  };

  return dataRows.map((cells, i): RawHealthCheck => {
    const rowNumber = i + 2; // header = row 1 → first data row = row 2

    const rawLatency =
      latencyColIndex >= 0 ? (cells[latencyColIndex] ?? "") : "";
    const { latency, latencyUnit } = splitLatency(rawLatency, latencyColName);

    return {
      rowNumber,
      serviceId: cell(cells, "serviceId"),
      serviceName: cell(cells, "serviceName"),
      timestamp: cell(cells, "timestamp"),
      statusCode: cell(cells, "statusCode"),
      latency,
      latencyUnit,
      agent: cell(cells, "agent"),
      region: cell(cells, "region"),
    };
  });
}
