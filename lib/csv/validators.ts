/**
 * lib/csv/validators.ts
 *
 * Pure validation functions for individual CSV field values.
 *
 * Contract:
 *   - Each function accepts an already-typed value (post-normalisation).
 *   - Returns void when valid.
 *   - Throws a ValidationError when invalid.
 *   - Never mutates the input — inspection only.
 *
 * The pipeline catches ValidationError and converts it to a RejectedRecord.
 * Nothing here touches CSV parsing, database access, or React.
 */

import type { RawHealthCheck, RejectionReason } from "./types";

// ---------------------------------------------------------------------------
// Structured validation error
// ---------------------------------------------------------------------------

/**
 * Thrown by every validator in this module.
 *
 * Carries a machine-readable `reason` (a RejectionReason code) so the
 * pipeline can convert it directly to a RejectedRecord without parsing
 * the human-readable `message` string.
 *
 * @example
 * try {
 *   validateStatus(code);
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     // err.reason  → "INVALID_STATUS"
 *     // err.details → "999 is outside the valid HTTP range [100, 599]"
 *   }
 * }
 */
export class ValidationError extends Error {
  readonly reason: RejectionReason;
  readonly details: string;

  constructor(reason: RejectionReason, details: string) {
    super(`${reason}: ${details}`);
    this.name = "ValidationError";
    this.reason = reason;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// validateStatus
// ---------------------------------------------------------------------------

/**
 * Validates that `statusCode` is a whole integer in the HTTP range [100, 599].
 *
 * Valid examples:   200, 201, 301, 404, 500, 503
 * Invalid examples: 99, 600, 999, NaN, 200.5
 *
 * @throws {ValidationError} with reason "INVALID_STATUS" if invalid.
 */
export function validateStatus(statusCode: number): void {
  if (!Number.isInteger(statusCode)) {
    throw new ValidationError(
      "INVALID_STATUS",
      `${statusCode} is not a whole integer`,
    );
  }

  if (statusCode < 100 || statusCode > 599) {
    throw new ValidationError(
      "INVALID_STATUS",
      `${statusCode} is outside the valid HTTP range [100, 599]`,
    );
  }
}

// ---------------------------------------------------------------------------
// validateLatency
// ---------------------------------------------------------------------------

/**
 * Validates a normalised latency value (already in milliseconds).
 *
 * Rules:
 *   - null is valid — the latency column is optional.
 *   - 0 is valid — zero latency is physically possible (loopback, cached).
 *   - Any negative value is invalid.
 *
 * @throws {ValidationError} with reason "NEGATIVE_LATENCY" if latencyMs < 0.
 */
export function validateLatency(latencyMs: number | null): void {
  if (latencyMs === null) return; // absent — not an error

  if (latencyMs < 0) {
    throw new ValidationError(
      "NEGATIVE_LATENCY",
      `latency must be ≥ 0 ms, got ${latencyMs}`,
    );
  }
}

// ---------------------------------------------------------------------------
// validateRequiredFields
// ---------------------------------------------------------------------------

/** Fields on RawHealthCheck that must be non-empty for a row to be accepted. */
const REQUIRED: ReadonlyArray<keyof RawHealthCheck> = [
  "serviceId",
  "serviceName",
  "timestamp",
  "statusCode",
  "agent",
  "region",
];

/**
 * Validates that every required field on a RawHealthCheck is present and
 * non-empty after trimming.
 *
 * Latency fields are intentionally excluded — they are optional.
 *
 * Does NOT mutate the record.
 *
 * @throws {ValidationError} with reason "MISSING_REQUIRED_FIELD" listing
 *   all missing fields (not just the first), so the rejection detail is as
 *   informative as possible.
 */
export function validateRequiredFields(record: RawHealthCheck): void {
  const missing = REQUIRED.filter((field) => {
    const value = record[field];
    // rowNumber is a number — never empty. All other required fields are strings.
    return typeof value === "string" && value.trim() === "";
  });

  if (missing.length > 0) {
    throw new ValidationError(
      "MISSING_REQUIRED_FIELD",
      `missing or empty: ${missing.join(", ")}`,
    );
  }
}
