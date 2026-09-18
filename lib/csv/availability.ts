/**
 * lib/csv/availability.ts
 *
 * Pure domain function: HTTP status code → availability.
 *
 * This function is the single source of truth for what "available" means.
 * It must not depend on CSV parsing, database access, or React.
 * Import it anywhere you need to evaluate or display availability:
 *   - lib/pipeline/validate-status.ts  (during ingestion)
 *   - dashboard calculation helpers    (for SLA metrics)
 *   - test fixtures                    (for expected values)
 */

/**
 * Returns true when the HTTP status code indicates the service was reachable
 * and responded successfully.
 *
 * Range: [200, 399] — includes both success (2xx) and redirect (3xx) codes.
 *
 * Examples from the dataset:
 *   200 → true   (OK)
 *   500 → false  (Internal Server Error)
 *   502 → false  (Bad Gateway)
 *   503 → false  (Service Unavailable)
 *
 * Why not 2xx only?
 *   3xx responses (e.g. 301 Moved Permanently, 302 Found) indicate the service
 *   is up and responding — a monitor that follows redirects sees a 2xx, but a
 *   monitor that does not still receives a valid response. Treating 3xx as
 *   available is consistent with how most uptime monitors define availability.
 *
 * @param statusCode - A validated HTTP status code integer in [100, 599].
 * @returns true if the status code is in [200, 399], false otherwise.
 */
export function isAvailable(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}
