import { describe, it, expect } from "vitest";
import { runPipeline } from "@/lib/pipeline";

// ---------------------------------------------------------------------------
// Shared fixture — a multi-row CSV that exercises every pipeline stage.
// ---------------------------------------------------------------------------
const FIXTURE_CSV = `service_id,service_name,timestamp,status_code,latency_ms,agent,region,is_available
svc-1,Alpha,2024-01-15T10:00:00Z,200,42ms,bot-a,us-east,true
svc-2,Beta,2024-01-15T10:05:00Z,503,180,bot-a,us-east,false
svc-1,Alpha,2024-01-15T10:00:00Z,200,42ms,bot-a,us-east,true
svc-3,Gamma,not-a-date,200,10,bot-b,eu-west,true
svc-4,Delta,2024-01-15T10:10:00Z,999,50,bot-c,ap-south,true
svc-5,Epsilon,2024-01-15T10:15:00Z,200,,bot-d,us-west,true
svc-6,Zeta,2024-01-15 10:20:00,200,75ms,bot-e,us-east,true`;

describe("runPipeline (end-to-end)", () => {
  it("returns correct totalRows count", () => {
    const { summary } = runPipeline(FIXTURE_CSV);
    // 7 data rows in the fixture
    expect(summary.totalRows).toBe(7);
  });

  it("counts a duplicate correctly", () => {
    const { summary } = runPipeline(FIXTURE_CSV);
    expect(summary.duplicateRows).toBe(1);
  });

  it("rejects the bad-timestamp row (svc-3)", () => {
    const { records, summary } = runPipeline(FIXTURE_CSV);
    const svc3 = records.find((r) => r.serviceId === "svc-3");
    expect(svc3).toBeUndefined();
    expect(summary.rejectedRows).toBeGreaterThanOrEqual(1);
  });

  it("rejects the out-of-range status code row (svc-4, 999)", () => {
    const { records } = runPipeline(FIXTURE_CSV);
    const svc4 = records.find((r) => r.serviceId === "svc-4");
    expect(svc4).toBeUndefined();
  });

  it("accepts svc-5 with a missing latencyMs (null)", () => {
    const { records } = runPipeline(FIXTURE_CSV);
    const svc5 = records.find((r) => r.serviceId === "svc-5");
    expect(svc5).toBeDefined();
    expect(svc5!.latencyMs).toBeNull();
  });

  it("parses latency 'ms' suffix correctly (svc-1)", () => {
    const { records } = runPipeline(FIXTURE_CSV);
    const svc1 = records.find((r) => r.serviceId === "svc-1");
    expect(svc1).toBeDefined();
    expect(svc1!.latencyMs).toBe(42);
  });

  it("parses space-separated timestamp as UTC (svc-6)", () => {
    const { records } = runPipeline(FIXTURE_CSV);
    const svc6 = records.find((r) => r.serviceId === "svc-6");
    expect(svc6).toBeDefined();
    expect(svc6!.timestampUtc.toISOString()).toBe("2024-01-15T10:20:00.000Z");
  });

  it("svc-2 has isAvailable=false and statusCode=503", () => {
    const { records } = runPipeline(FIXTURE_CSV);
    const svc2 = records.find((r) => r.serviceId === "svc-2");
    expect(svc2).toBeDefined();
    expect(svc2!.isAvailable).toBe(false);
    expect(svc2!.statusCode).toBe(503);
  });

  it("accepted + rejected + duplicates accounts for all rows", () => {
    const { summary } = runPipeline(FIXTURE_CSV);
    expect(
      summary.acceptedRows + summary.rejectedRows + summary.duplicateRows
    ).toBe(summary.totalRows);
  });

  it("issues array is non-empty and contains errors and warnings", () => {
    const { summary } = runPipeline(FIXTURE_CSV);
    const severities = summary.issues.map((i) => i.severity);
    expect(severities).toContain("error");
    expect(severities).toContain("warning");
  });

  it("accepts a Buffer as input", () => {
    const buf = Buffer.from(FIXTURE_CSV);
    const { records } = runPipeline(buf);
    expect(records.length).toBeGreaterThan(0);
  });

  it("throws on a completely empty CSV", () => {
    expect(() => runPipeline("")).toThrow();
  });

  it("propagates an unknown column warning (rowIndex = -1)", () => {
    const csv = `service_id,service_name,timestamp,status_code,latency_ms,agent,region,mystery_col
svc-1,Alpha,2024-01-15T10:00:00Z,200,42,bot,us-east,ignore_me`;
    const { summary } = runPipeline(csv);
    const unknownIssue = summary.issues.find((i) => i.rowIndex === -1);
    expect(unknownIssue).toBeDefined();
    expect(unknownIssue!.message).toMatch(/mystery_col/);
  });
});
