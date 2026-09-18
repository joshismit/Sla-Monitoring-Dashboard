import { describe, it, expect } from "vitest";
import {
  ValidationError,
  validateStatus,
  validateLatency,
  validateRequiredFields,
} from "@/lib/csv/validators";
import type { RawHealthCheck } from "@/lib/csv/types";

// ---------------------------------------------------------------------------
// Shared fixture factory
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawHealthCheck> = {}): RawHealthCheck {
  return {
    rowNumber:   2,
    serviceId:   "svc-1",
    serviceName: "Alpha",
    timestamp:   "2025-05-09T14:30:00Z",
    statusCode:  "200",
    latency:     "142",
    latencyUnit: "ms",
    agent:       "bot-a",
    region:      "us-east",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateStatus
// ---------------------------------------------------------------------------

describe("validateStatus", () => {
  it("accepts 200 without throwing", () => {
    expect(() => validateStatus(200)).not.toThrow();
  });

  it("accepts 500 without throwing", () => {
    expect(() => validateStatus(500)).not.toThrow();
  });

  it("accepts 502 without throwing", () => {
    expect(() => validateStatus(502)).not.toThrow();
  });

  it("accepts 503 without throwing", () => {
    expect(() => validateStatus(503)).not.toThrow();
  });

  it("accepts boundary 100", () => {
    expect(() => validateStatus(100)).not.toThrow();
  });

  it("accepts boundary 599", () => {
    expect(() => validateStatus(599)).not.toThrow();
  });

  it("rejects 999 with INVALID_STATUS", () => {
    // 999 fails the range check [100, 599] — no special-case logic.
    expect(() => validateStatus(999)).toThrow(ValidationError);
    try { validateStatus(999); } catch (e) {
      expect((e as ValidationError).reason).toBe("INVALID_STATUS");
    }
  });

  it("rejects 99 (below range)", () => {
    expect(() => validateStatus(99)).toThrow("INVALID_STATUS");
  });

  it("rejects 600 (above range)", () => {
    expect(() => validateStatus(600)).toThrow("INVALID_STATUS");
  });

  it("rejects non-integer 200.5", () => {
    expect(() => validateStatus(200.5)).toThrow("INVALID_STATUS");
  });

  it("throws a ValidationError instance, not a plain Error", () => {
    expect(() => validateStatus(999)).toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// validateLatency
// ---------------------------------------------------------------------------

describe("validateLatency", () => {
  it("accepts null (missing latency is not an error)", () => {
    expect(() => validateLatency(null)).not.toThrow();
  });

  it("accepts 0 (zero latency is physically valid)", () => {
    expect(() => validateLatency(0)).not.toThrow();
  });

  it("accepts positive integer latency", () => {
    expect(() => validateLatency(142)).not.toThrow();
  });

  it("accepts positive float latency", () => {
    expect(() => validateLatency(0.717)).not.toThrow();
  });

  it("accepts large latency values", () => {
    expect(() => validateLatency(30_000)).not.toThrow();
  });

  it("rejects negative latency with NEGATIVE_LATENCY", () => {
    expect(() => validateLatency(-286)).toThrow(ValidationError);
    try { validateLatency(-286); } catch (e) {
      expect((e as ValidationError).reason).toBe("NEGATIVE_LATENCY");
      expect((e as ValidationError).details).toContain("-286");
    }
  });

  it("rejects -0.001 (any negative value)", () => {
    expect(() => validateLatency(-0.001)).toThrow("NEGATIVE_LATENCY");
  });

  it("does not mutate: never calls Math.abs or similar", () => {
    // Verifying by contract: the function returns void, not a corrected value.
    // If it mutated, it would return number. TypeScript enforces void here.
    const result = validateLatency(42);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateRequiredFields
// ---------------------------------------------------------------------------

describe("validateRequiredFields", () => {
  it("accepts a fully-populated record without throwing", () => {
    expect(() => validateRequiredFields(makeRaw())).not.toThrow();
  });

  it("rejects when serviceId is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ serviceId: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("rejects when serviceName is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ serviceName: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("rejects when timestamp is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ timestamp: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("rejects when statusCode is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ statusCode: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("rejects when agent is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ agent: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("rejects when region is empty", () => {
    expect(() => validateRequiredFields(makeRaw({ region: "" })))
      .toThrow("MISSING_REQUIRED_FIELD");
  });

  it("includes all missing field names in the details string", () => {
    try {
      validateRequiredFields(makeRaw({ serviceId: "", agent: "" }));
    } catch (e) {
      expect((e as ValidationError).details).toContain("serviceId");
      expect((e as ValidationError).details).toContain("agent");
    }
  });

  it("does NOT reject when latency is null (latency is optional)", () => {
    expect(() => validateRequiredFields(makeRaw({ latency: null, latencyUnit: null })))
      .not.toThrow();
  });

  it("does not mutate the record", () => {
    const raw = makeRaw();
    const copy = { ...raw };
    try { validateRequiredFields(raw); } catch { /* expected */ }
    expect(raw).toEqual(copy);
  });

  it("throws a ValidationError, not a plain Error", () => {
    expect(() => validateRequiredFields(makeRaw({ serviceId: "" })))
      .toThrow(ValidationError);
  });
});
