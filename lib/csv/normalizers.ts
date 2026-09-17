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
