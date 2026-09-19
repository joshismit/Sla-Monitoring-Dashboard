import { describe, it, expect } from "vitest";
import { validateRecord } from "@/lib/pipeline/validate-record";
import type { PreValidatedRow } from "@/lib/pipeline/validate-record";

function makeRow(overrides: Partial<PreValidatedRow> = {}): PreValidatedRow {
  return {
    rowIndex: 0,
    serviceId: "svc-1",
    serviceName: "Alpha",
    timestampUtc: "2024-01-01T00:00:00Z",
    statusCode: "200",
    agent: "bot",
    region: "us-east",
    _timestampParsed: new Date("2024-01-01T00:00:00Z"),
    _latencyParsed: 42,
    _latencyRejected: false,
    _statusCodeParsed: 200,
    _isAvailableParsed: true,
    ...overrides,
  };
}

describe("validateRecord", () => {
  it("accepts a fully valid row and returns a HealthCheckRecord", () => {
    const { records, issues, rejectedRowIndices } = validateRecord([makeRow()]);
    expect(issues).toHaveLength(0);
    expect(rejectedRowIndices.size).toBe(0);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.serviceId).toBe("svc-1");
    expect(r.serviceName).toBe("Alpha");
    expect(r.timestampUtc).toBeInstanceOf(Date);
    expect(r.statusCode).toBe(200);
    expect(r.latencyMs).toBe(42);
    expect(r.agent).toBe("bot");
    expect(r.region).toBe("us-east");
    expect(r.isAvailable).toBe(true);
  });

  it("allows null latencyMs (optional field)", () => {
    const { records, issues } = validateRecord([makeRow({ _latencyParsed: null })]);
    expect(issues).toHaveLength(0);
    expect(records[0].latencyMs).toBeNull();
  });

  it("rejects a row with null _timestampParsed", () => {
    const { records, rejectedRowIndices, issues } = validateRecord([
      makeRow({ _timestampParsed: null }),
    ]);
    expect(records).toHaveLength(0);
    expect(rejectedRowIndices.has(0)).toBe(true);
    expect(issues.some((i) => i.field === "timestampUtc")).toBe(true);
  });

  it("rejects a row with null _statusCodeParsed", () => {
    const { records, rejectedRowIndices } = validateRecord([
      makeRow({ _statusCodeParsed: null }),
    ]);
    expect(records).toHaveLength(0);
    expect(rejectedRowIndices.has(0)).toBe(true);
  });

  it("rejects a row with null _isAvailableParsed", () => {
    const { records, rejectedRowIndices } = validateRecord([
      makeRow({ _isAvailableParsed: null }),
    ]);
    expect(records).toHaveLength(0);
    expect(rejectedRowIndices.has(0)).toBe(true);
  });

  it("rejects a row with missing serviceId", () => {
    const { records, issues } = validateRecord([
      makeRow({ serviceId: undefined }),
    ]);
    expect(records).toHaveLength(0);
    expect(issues.some((i) => i.field === "serviceId")).toBe(true);
  });

  it("rejects a row with empty serviceName", () => {
    const { records, issues } = validateRecord([
      makeRow({ serviceName: "" }),
    ]);
    expect(records).toHaveLength(0);
    expect(issues.some((i) => i.field === "serviceName")).toBe(true);
  });

  it("rejects a row with missing agent", () => {
    const { records, issues } = validateRecord([
      makeRow({ agent: undefined }),
    ]);
    expect(records).toHaveLength(0);
    expect(issues.some((i) => i.field === "agent")).toBe(true);
  });

  it("rejects a row with missing region", () => {
    const { records, issues } = validateRecord([
      makeRow({ region: undefined }),
    ]);
    expect(records).toHaveLength(0);
    expect(issues.some((i) => i.field === "region")).toBe(true);
  });

  it("accumulates errors from multiple fields in one row", () => {
    const { issues, rejectedRowIndices } = validateRecord([
      makeRow({ serviceId: undefined, region: undefined }),
    ]);
    expect(rejectedRowIndices.has(0)).toBe(true);
    expect(issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(2);
  });

  it("accepts valid rows and rejects invalid in the same batch", () => {
    const { records, rejectedRowIndices } = validateRecord([
      makeRow({ rowIndex: 0 }),
      makeRow({ rowIndex: 1, _timestampParsed: null }),
      makeRow({ rowIndex: 2 }),
    ]);
    expect(records).toHaveLength(2);
    expect(rejectedRowIndices.has(1)).toBe(true);
    expect(rejectedRowIndices.has(0)).toBe(false);
  });
});
