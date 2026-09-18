import { describe, it, expect } from "vitest";
import { deduplicateRecords } from "@/lib/pipeline/deduplicate";
import type { HealthCheckRecord } from "@/lib/pipeline/types";

function makeRecord(overrides: Partial<HealthCheckRecord> = {}): HealthCheckRecord {
  return {
    serviceId: "svc-1",
    serviceName: "Alpha",
    timestampUtc: new Date("2024-01-01T00:00:00Z"),
    statusCode: 200,
    latencyMs: 42,
    agent: "bot",
    region: "us-east",
    isAvailable: true,
    ...overrides,
  };
}

describe("deduplicateRecords", () => {
  it("returns all records when there are no duplicates", () => {
    const records = [
      makeRecord({ serviceId: "svc-1", timestampUtc: new Date("2024-01-01T00:00:00Z") }),
      makeRecord({ serviceId: "svc-2", timestampUtc: new Date("2024-01-01T00:00:00Z") }),
    ];
    const { records: out, duplicateCount, issues } = deduplicateRecords(records, [0, 1]);
    expect(out).toHaveLength(2);
    expect(duplicateCount).toBe(0);
    expect(issues).toHaveLength(0);
  });

  it("removes a duplicate and increments duplicateCount", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const records = [makeRecord({ timestampUtc: ts }), makeRecord({ timestampUtc: ts })];
    const { records: out, duplicateCount, issues } = deduplicateRecords(records, [0, 1]);
    expect(out).toHaveLength(1);
    expect(duplicateCount).toBe(1);
    expect(issues).toHaveLength(1);
    expect(issues[0].rowIndex).toBe(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("keeps the first occurrence on duplicate", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const first = makeRecord({ timestampUtc: ts, latencyMs: 10 });
    const second = makeRecord({ timestampUtc: ts, latencyMs: 999 });
    const { records: out } = deduplicateRecords([first, second], [0, 1]);
    expect(out[0].latencyMs).toBe(10);
  });

  it("differentiates by agent", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const records = [
      makeRecord({ timestampUtc: ts, agent: "bot-a" }),
      makeRecord({ timestampUtc: ts, agent: "bot-b" }),
    ];
    const { records: out, duplicateCount } = deduplicateRecords(records, [0, 1]);
    expect(out).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it("differentiates by region", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const records = [
      makeRecord({ timestampUtc: ts, region: "us-east" }),
      makeRecord({ timestampUtc: ts, region: "eu-west" }),
    ];
    const { records: out } = deduplicateRecords(records, [0, 1]);
    expect(out).toHaveLength(2);
  });

  it("differentiates by timestamp", () => {
    const records = [
      makeRecord({ timestampUtc: new Date("2024-01-01T00:00:00Z") }),
      makeRecord({ timestampUtc: new Date("2024-01-01T00:01:00Z") }),
    ];
    const { records: out } = deduplicateRecords(records, [0, 1]);
    expect(out).toHaveLength(2);
  });

  it("treats timezone-equivalent timestamps as duplicates (why normalisation precedes deduplication)", () => {
    // "2025-05-09T14:30:00Z" and "2025-05-09T20:00:00+05:30" are the same
    // UTC instant — 20:00 IST minus 5h30m = 14:30 UTC.
    //
    // String comparison: different → would produce two records. ❌
    // Date comparison:   same      → correctly produces one record. ✅
    //
    // This test proves the pipeline order must be:
    //   normalizeTimestamp → deduplicateRecords
    // and NOT:
    //   deduplicateRecords → normalizeTimestamp
    //
    // By the time records reach deduplicateRecords(), _timestampParsed is
    // already a Date. Both timestamps produce the same toISOString() output
    // ("2025-05-09T14:30:00.000Z") and therefore the same composite key.
    const utcInstant    = new Date("2025-05-09T14:30:00Z");       // +00:00
    const offsetInstant = new Date("2025-05-09T20:00:00+05:30");  // +05:30

    // Sanity-check the fixture: both Dates must represent the same ms.
    expect(utcInstant.getTime()).toBe(offsetInstant.getTime());

    const records = [
      makeRecord({ timestampUtc: utcInstant }),
      makeRecord({ timestampUtc: offsetInstant }),
    ];
    const { records: out, duplicateCount } = deduplicateRecords(records, [0, 1]);

    expect(out).toHaveLength(1);       // one accepted
    expect(duplicateCount).toBe(1);    // one duplicate discarded
  });

  it("handles three copies of the same record", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const records = Array(3).fill(makeRecord({ timestampUtc: ts }));
    const { records: out, duplicateCount } = deduplicateRecords(records, [0, 1, 2]);
    expect(out).toHaveLength(1);
    expect(duplicateCount).toBe(2);
  });

  it("reports the original row index in duplicate issues", () => {
    const ts = new Date("2024-01-01T00:00:00Z");
    const records = [makeRecord({ timestampUtc: ts }), makeRecord({ timestampUtc: ts })];
    const { issues } = deduplicateRecords(records, [5, 12]);
    expect(issues[0].rowIndex).toBe(12);
    expect(issues[0].message).toContain("row 5"); // first occurrence
  });

  it("returns empty arrays for empty input", () => {
    const { records, duplicateCount, issues } = deduplicateRecords([], []);
    expect(records).toHaveLength(0);
    expect(duplicateCount).toBe(0);
    expect(issues).toHaveLength(0);
  });
});
