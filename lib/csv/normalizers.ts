/**
 * lib/csv/normalizers.ts
 *
 * Pure normalisation functions: raw string → typed value.
 *
 * Each function:
 *   - Accepts the raw string from RawHealthCheck
 *   - Returns the typed value for CleanHealthCheck
 *   - Throws a descriptive Error on invalid input
 *     (the pipeline stage catches and converts to RejectedRecord)
 *
 * No side effects. No I/O. No database.
 */

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

/**
 * Returns true when `value` is a pure sequence of ASCII digits.
 * Used to distinguish Unix epoch strings from ISO 8601 strings.
 *
 * Examples that match:    "1746764100"  "0"  "9999999999"
 * Examples that don't:    "2025-05-13T12:45:00Z"  "1746764100.5"  ""
 */
function isUnixEpochSeconds(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Normalise a raw timestamp string to a JavaScript Date (UTC instant).
 *
 * Supported formats:
 *   - ISO 8601 UTC          "2025-05-13T12:45:00Z"
 *   - ISO 8601 with offset  "2025-05-09T20:00:00+05:30"
 *   - Unix epoch seconds    "1746764100"   (integer string, no decimal)
 *
 * ⚠️  Do NOT use new Date(`${value} UTC`):
 *     that appends a second timezone qualifier which corrupts values that
 *     already carry an explicit offset (e.g. "+05:30" becomes ambiguous).
 *
 *     Instead, detect the format first:
 *       • All-digit string  → multiply by 1000, pass to Date constructor
 *       • Anything else     → pass directly to Date constructor
 *     JavaScript's Date constructor parses ISO 8601 with any offset
 *     correctly and stores the result as the equivalent UTC instant.
 *
 * @throws {Error} If the value cannot be parsed to a valid date.
 */
export function normalizeTimestamp(value: string): Date {
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new Error("Timestamp is empty.");
  }

  // Unix epoch seconds: pure digit string → no timezone ambiguity possible.
  if (isUnixEpochSeconds(trimmed)) {
    return new Date(Number(trimmed) * 1000);
  }

  // ISO 8601 (with Z or with ±HH:mm offset).
  // new Date() parses the offset and converts to the correct UTC instant.
  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: "${trimmed}"`);
  }

  return date;
}

// ---------------------------------------------------------------------------
// Latency
// ---------------------------------------------------------------------------

/**
 * Unit strings the normaliser recognises as seconds.
 * Compared against the lower-cased latencyUnit from RawHealthCheck.
 */
const SECONDS_UNITS = new Set(["s", "sec", "secs", "second", "seconds"]);

/**
 * Unit strings the normaliser recognises as milliseconds.
 * null is also treated as milliseconds (the parser defaults to ms when the
 * column name implies it, e.g. "latency_ms").
 */
const MS_UNITS = new Set(["ms", "milli", "millis", "millisecond", "milliseconds"]);

/**
 * Normalise a raw latency value to milliseconds.
 *
 * Rules:
 *   - null value              → null   (column absent or empty — not an error)
 *   - non-numeric value       → throws (pipeline maps to INVALID_LATENCY)
 *   - negative value          → throws (pipeline maps to NEGATIVE_LATENCY)
 *   - unit "ms" or null unit  → value as-is (already milliseconds)
 *   - unit "s" / "sec" / …   → value × 1000  (no rounding; precision preserved)
 *
 * @param value - The numeric portion of the latency string, or null if absent.
 * @param unit  - The unit suffix (lower-cased by the parser), or null.
 * @returns Latency in milliseconds, or null when value is null.
 * @throws {Error} When value is present but non-numeric or negative.
 */
export function normalizeLatency(
  value: string | null,
  unit: string | null,
): number | null {
  // Absent / empty column — not an error, just no latency data.
  if (value === null) return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = parseFloat(trimmed);

  if (Number.isNaN(parsed)) {
    throw new Error(
      `INVALID_LATENCY: "${trimmed}" is not a numeric value.`,
    );
  }

  if (parsed < 0) {
    throw new Error(
      `NEGATIVE_LATENCY: latency must be ≥ 0, got ${parsed}.`,
    );
  }

  // Resolve the unit — normalise to lowercase for comparison.
  const lowerUnit = unit?.trim().toLowerCase() ?? null;

  if (lowerUnit === null || MS_UNITS.has(lowerUnit)) {
    // Already in milliseconds (or assumed to be).
    return parsed;
  }

  if (SECONDS_UNITS.has(lowerUnit)) {
    // Convert seconds → milliseconds. Multiply preserves full float precision;
    // no rounding is applied (e.g. 0.717 s → 717 ms exactly).
    return parsed * 1000;
  }

  // Unrecognised unit — treat as invalid so the pipeline can flag it.
  throw new Error(
    `INVALID_LATENCY: unrecognised unit "${unit}". ` +
      `Expected one of: ms, s, sec, seconds (or null to assume ms).`,
  );
}
