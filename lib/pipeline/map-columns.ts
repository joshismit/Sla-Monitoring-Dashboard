/**
 * lib/pipeline/map-columns.ts
 *
 * Stage 2: Map raw CSV headers to canonical field names.
 * Case-insensitive. Normalises spaces, hyphens, and underscores before matching.
 * Unknown columns are collected but do NOT cause rejection.
 */

import type { ParsedCSV } from "./parse-csv";
import type { ColumnMappingResult, RawRow } from "./types";

// ---------------------------------------------------------------------------
// Alias table — key: canonical field name, value: accepted raw header variants
// All comparisons happen against a normalised form (see normaliseHeader below).
// ---------------------------------------------------------------------------
const ALIAS_TABLE: Record<keyof Omit<RawRow, "rowIndex">, string[]> = {
  serviceId: ["service_id", "serviceid", "id"],
  serviceName: ["service_name", "servicename", "name", "service"],
  timestampUtc: [
    "timestamp_utc",
    "timestamputc",
    "timestamp",
    "time",
    "ts",
    "date",
    "datetime",
  ],
  statusCode: [
    "status_code",
    "statuscode",
    "status",
    "http_status",
    "httpstatus",
    "http_status_code",
  ],
  latencyMs: [
    "latency_ms",
    "latencyms",
    "latency",
    "response_time",
    "responsetime",
    "response_ms",
  ],
  agent: ["agent", "monitor_agent", "monitoragent", "checker"],
  region: ["region", "zone", "location", "datacenter", "data_center"],
  isAvailable: [
    "is_available",
    "isavailable",
    "available",
    "up",
    "is_up",
    "isup",
  ],
};

/** Strip all non-alphanumeric characters and lowercase for fuzzy matching. */
function normaliseHeader(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Build a lookup: normalised alias → canonical field name. */
const ALIAS_LOOKUP: Map<string, keyof Omit<RawRow, "rowIndex">> = new Map();
for (const [canonical, aliases] of Object.entries(ALIAS_TABLE) as [
  keyof Omit<RawRow, "rowIndex">,
  string[],
][]) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normaliseHeader(alias), canonical);
  }
}

/**
 * Maps raw CSV headers to canonical field names and converts each data row
 * into a `RawRow` object (values still as strings).
 *
 * @param parsed - Output of `parseCSV()`
 * @returns Mapped rows and a list of unrecognised column names.
 */
export function mapColumns(parsed: ParsedCSV): ColumnMappingResult {
  const { headers, rows } = parsed;

  // Resolve each header index to a canonical name (or null if unknown)
  const columnMap: (keyof Omit<RawRow, "rowIndex"> | null)[] = headers.map(
    (h) => ALIAS_LOOKUP.get(normaliseHeader(h)) ?? null
  );

  const unknownColumns = headers.filter(
    (_, i) => columnMap[i] === null
  );

  const mappedRows: RawRow[] = rows.map((cells, rowIndex) => {
    const row: RawRow = { rowIndex };
    cells.forEach((value, colIndex) => {
      const canonical = columnMap[colIndex];
      if (canonical !== null) {
        // Only assign non-empty strings; treat empty string as absent.
        const trimmed = value.trim();
        if (trimmed !== "") {
          (row as Record<string, string | number>)[canonical] = trimmed;
        }
      }
    });
    return row;
  });

  return { rows: mappedRows, unknownColumns };
}
