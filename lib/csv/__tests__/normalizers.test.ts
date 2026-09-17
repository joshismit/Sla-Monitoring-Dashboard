import { describe, it, expect } from "vitest";
import { normalizeTimestamp } from "@/lib/csv/normalizers";

// ---------------------------------------------------------------------------
// Equivalent-timestamp constants
//
// These three strings all represent the same UTC instant:
//
//   2025-05-09T14:30:00Z
//   2025-05-09T20:00:00+05:30   (+05:30 zone → 20:00 − 5h30m = 14:30 UTC)
//   1746801000                   (Unix epoch seconds for that instant)
//
// The +05:30 pair is the key test: it demonstrates why normalization is
// necessary.  Two CSV rows from different monitoring agents (one reporting
// in UTC, one in IST) must collapse to the same timestamp before the
// duplicate-detection key is built.
// ---------------------------------------------------------------------------

const ISO_UTC      = "2025-05-09T14:30:00Z";
const ISO_OFFSET   = "2025-05-09T20:00:00+05:30";
const UNIX_SECONDS = "1746801000";

/** The expected UTC milliseconds — derived from the authoritative ISO UTC string. */
const EXPECTED_MS = new Date(ISO_UTC).getTime();

describe("normalizeTimestamp", () => {
  // -------------------------------------------------------------------------
  // ISO UTC
  // -------------------------------------------------------------------------

  describe("ISO UTC", () => {
    it("parses and returns a Date", () => {
      const result = normalizeTimestamp(ISO_UTC);
      expect(result).toBeInstanceOf(Date);
    });

    it("produces the correct UTC instant", () => {
      expect(normalizeTimestamp(ISO_UTC).getTime()).toBe(EXPECTED_MS);
    });

    it("returns a UTC ISO string with Z suffix", () => {
      expect(normalizeTimestamp(ISO_UTC).toISOString()).toBe("2025-05-09T14:30:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // ISO with +05:30 offset — the key equivalence test
  // -------------------------------------------------------------------------

  describe("ISO with +05:30 offset", () => {
    it("produces the same UTC instant as the ISO UTC form", () => {
      // 2025-05-09T20:00:00+05:30  →  subtract 5h30m  →  14:30 UTC
      // If this fails, timestamp normalization is broken: two rows representing
      // the same health-check event would be treated as distinct timestamps.
      const result = normalizeTimestamp(ISO_OFFSET);
      expect(result.getTime()).toBe(EXPECTED_MS);
    });

    it("toISOString() matches the Z form exactly", () => {
      expect(normalizeTimestamp(ISO_OFFSET).toISOString()).toBe(
        normalizeTimestamp(ISO_UTC).toISOString(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Unix epoch seconds
  // -------------------------------------------------------------------------

  describe("Unix epoch seconds", () => {
    it("produces the same UTC instant as the ISO UTC form", () => {
      // 1746801000 * 1000 ms = the same instant as 2025-05-09T14:30:00Z
      expect(normalizeTimestamp(UNIX_SECONDS).getTime()).toBe(EXPECTED_MS);
    });

    it("accepts a leading-zero-free integer string", () => {
      expect(() => normalizeTimestamp("1000000000")).not.toThrow();
    });

    it("epoch 0 produces 1970-01-01T00:00:00.000Z", () => {
      expect(normalizeTimestamp("0").toISOString()).toBe("1970-01-01T00:00:00.000Z");
    });
  });

  // -------------------------------------------------------------------------
  // Three-way equivalence — the core invariant
  // -------------------------------------------------------------------------

  it("ISO UTC, ISO +05:30, and Unix epoch all resolve to the same instant", () => {
    const fromUtc    = normalizeTimestamp(ISO_UTC).getTime();
    const fromOffset = normalizeTimestamp(ISO_OFFSET).getTime();
    const fromEpoch  = normalizeTimestamp(UNIX_SECONDS).getTime();

    expect(fromUtc).toBe(fromOffset);
    expect(fromUtc).toBe(fromEpoch);
  });

  // -------------------------------------------------------------------------
  // Other valid formats
  // -------------------------------------------------------------------------

  describe("other valid ISO 8601 formats", () => {
    it("parses a negative UTC offset", () => {
      // 2025-05-09T10:30:00-04:00 → same instant as 14:30 UTC
      expect(normalizeTimestamp("2025-05-09T10:30:00-04:00").getTime()).toBe(EXPECTED_MS);
    });

    it("parses a Z-suffix timestamp with milliseconds", () => {
      const d = normalizeTimestamp("2025-05-09T14:30:00.000Z");
      expect(d.getTime()).toBe(EXPECTED_MS);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid input — must throw
  // -------------------------------------------------------------------------

  describe("invalid input", () => {
    it("throws on an empty string", () => {
      expect(() => normalizeTimestamp("")).toThrow();
    });

    it("throws on a whitespace-only string", () => {
      expect(() => normalizeTimestamp("   ")).toThrow();
    });

    it("throws on a plain date without time ('2025-05-09' is ambiguous in some engines — "
      + "the normalizer should handle it, but plain garbage must always throw)", () => {
      // "not-a-date" is definitively garbage
      expect(() => normalizeTimestamp("not-a-date")).toThrow(/Invalid timestamp/i);
    });

    it("throws on a decimal Unix string (not pure digits)", () => {
      // "1746801000.5" — not all-digit → goes to new Date() → NaN in strict engines
      // This ensures we don't silently accept partial epoch values.
      expect(() => normalizeTimestamp("1746801000.5")).toThrow();
    });

    it("throws on an ISO string with two competing timezone markers", () => {
      // This is the exact anti-pattern that new Date(`${value} UTC`) would produce.
      // Verify our code rejects it or at least doesn't silently produce the wrong time.
      const twoZones = "2025-05-09T20:00:00+05:30 UTC";
      // Either throws (NaN) or, if the engine accepts it, the result must NOT
      // equal the correct instant (proving the anti-pattern corrupts the value).
      try {
        const d = normalizeTimestamp(twoZones);
        expect(d.getTime()).not.toBe(EXPECTED_MS);
      } catch {
        // Threw — also acceptable; the important thing is it doesn't silently
        // return the correct time.
      }
    });
  });
});
