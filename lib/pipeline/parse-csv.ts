/**
 * lib/pipeline/parse-csv.ts
 *
 * Stage 1: Parse raw CSV text into a header row + data rows.
 * Uses the existing `csv-parse` dependency (sync variant).
 * Returns nothing but plain strings — no domain knowledge here.
 */

import { parse } from "csv-parse/sync";

export interface ParsedCSV {
  headers: string[];
  /** Each inner array corresponds to one data row, aligned with `headers`. */
  rows: string[][];
}

/**
 * Parses a CSV string (or Buffer) into a header row and data rows.
 *
 * - Trims whitespace from every cell value.
 * - Skips completely empty rows.
 * - Throws a descriptive error if the CSV has fewer than 2 rows (header + 1 data row).
 */
export function parseCSV(input: string | Buffer): ParsedCSV {
  const records: string[][] = parse(input, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // tolerate rows with fewer columns than the header
  });

  if (records.length === 0) {
    throw new Error("CSV is empty — no rows found.");
  }

  const [headerRow, ...dataRows] = records;

  if (headerRow.length === 0) {
    throw new Error("CSV header row is empty.");
  }

  if (dataRows.length === 0) {
    throw new Error("CSV has a header row but no data rows.");
  }

  return {
    headers: headerRow,
    rows: dataRows,
  };
}
