/**
 * lib/csv/derive-date-range.ts
 *
 * Derives the temporal extent of a set of clean records.
 *
 * The date range is ALWAYS computed from the data — it is never hardcoded.
 * Callers must not pass start/end dates as constants; pass the accepted
 * records and let this function discover the bounds.
 */

import type { CleanHealthCheck, DateRange } from "./types";

/**
 * Compute the minimum and maximum `timestampUtc` across all accepted records.
 *
 * @param records - The accepted CleanHealthCheck records from the pipeline.
 * @returns A DateRange with the earliest and latest timestamps,
 *          or null if the array is empty.
 *
 * @example
 * const range = deriveDateRange(result.records);
 * if (range) {
 *   console.log(range.min.toISOString()); // e.g. "2025-04-10T00:00:00.000Z"
 *   console.log(range.max.toISOString()); // e.g. "2025-04-21T23:59:59.000Z"
 * }
 */
export function deriveDateRange(records: CleanHealthCheck[]): DateRange | null {
  if (records.length === 0) return null;

  let minMs = records[0].timestampUtc.getTime();
  let maxMs = minMs;

  for (let i = 1; i < records.length; i++) {
    const t = records[i].timestampUtc.getTime();
    if (t < minMs) minMs = t;
    if (t > maxMs) maxMs = t;
  }

  return {
    min: new Date(minMs),
    max: new Date(maxMs),
  };
}
