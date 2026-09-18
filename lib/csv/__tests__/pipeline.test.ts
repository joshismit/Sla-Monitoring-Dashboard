import { describe, it, expect } from "vitest";
import { processCsv, CsvParseError } from "@/lib/csv/pipeline";

// ---------------------------------------------------------------------------
// Fixture
//
// 9 data rows that deliberately exercise every pipeline path:
//
//  Row  │ serviceId │ Description                          │ Expected outcome
//  ─────┼───────────┼──────────────────────────────────────┼─────────────────
//   2   │ svc-200   │ Valid 200, ms latency, UTC ts        │ accepted, available
//   3   │ svc-500   │ Valid 500, ms latency                │ accepted, unavailable
//   4   │ svc-sec   │ Seconds latency (0.717 s → 717 ms)  │ accepted, latencyMs=717
//   5   │ svc-tz    │ +05:30 timestamp (= row 6's UTC)    │ accepted (first occurrence)
//   6   │ svc-tz    │ UTC form of row 5 → duplicate        │ duplicate
//   7   │ svc-unix  │ Unix epoch timestamp                  │ accepted
//   8   │ svc-nolat │ Missing latency column               │ accepted, latencyMs=null
//   9   │ svc-neg   │ Negative latency (-286 ms)           │ rejected NEGATIVE_LATENCY
//  10   │ svc-999   │ Status 999 (out of range)            │ rejected INVALID_STATUS
//
// Summary:
//   totalRows    = 9
//   acceptedRows = 6  (svc-200, svc-500, svc-sec, svc-tz first, svc-unix, svc-nolat)
//   rejectedRows = 2  (svc-neg, svc-999)
//   duplicateRows= 1  (svc-tz UTC form)
// ---------------------------------------------------------------------------

const FIXTURE_CSV = `service_id,service_name,timestamp,status_code,latency_ms,agent,region
svc-200,API Gateway,2025-05-09T14:30:00Z,200,142ms,bot-a,us-east
svc-500,Auth Service,2025-05-09T14:31:00Z,500,350ms,bot-a,us-east
svc-sec,DB Primary,2025-05-09T14:32:00Z,200,0.717s,bot-b,eu-west
svc-tz,Cache,2025-05-09T20:00:00+05:30,200,50ms,bot-a,us-east
svc-tz,Cache,2025-05-09T14:30:00Z,200,50ms,bot-a,us-east
svc-unix,Worker,1746801060,200,100ms,bot-c,ap-south
svc-nolat,Metrics,2025-05-09T14:33:00Z,200,,bot-a,us-east
svc-neg,Proxy,2025-05-09T14:34:00Z,200,-286ms,bot-a,us-east
svc-999,Webhook,2025-05-09T14:35:00Z,999,100ms,bot-a,us-east`;

describe("processCsv — full pipeline integration", () => {
  // -------------------------------------------------------------------------
  // Row counts
  // -------------------------------------------------------------------------

  it("reports correct totalRows", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.totalRows).toBe(9);
  });

  it("reports correct acceptedRows", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.acceptedRows).toBe(6);
  });

  it("reports correct rejectedRows", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.rejectedRows).toBe(2);
  });

  it("reports correct duplicateRows", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.duplicateRows).toBe(1);
  });

  it("totalRows = acceptedRows + rejectedRows + duplicateRows", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.acceptedRows + summary.rejectedRows + summary.duplicateRows)
      .toBe(summary.totalRows);
  });

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  it("svc-200 is available (statusCode 200)", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-200")!;
    expect(r).toBeDefined();
    expect(r.isAvailable).toBe(true);
    expect(r.statusCode).toBe(200);
  });

  it("svc-500 is unavailable (statusCode 500)", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-500")!;
    expect(r).toBeDefined();
    expect(r.isAvailable).toBe(false);
    expect(r.statusCode).toBe(500);
  });

  // -------------------------------------------------------------------------
  // Latency normalisation
  // -------------------------------------------------------------------------

  it("parses 142ms → 142 (ms suffix stripped)", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-200")!;
    expect(r.latencyMs).toBe(142);
  });

  it("converts 0.717s → 717ms (seconds to milliseconds, no rounding)", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-sec")!;
    expect(r).toBeDefined();
    expect(r.latencyMs).toBe(717);
  });

  it("accepts missing latency as null (optional field)", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-nolat")!;
    expect(r).toBeDefined();
    expect(r.latencyMs).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Timestamp normalisation
  // -------------------------------------------------------------------------

  it("parses Unix epoch timestamp to a valid Date", () => {
    const { records } = processCsv(FIXTURE_CSV);
    const r = records.find((r) => r.serviceId === "svc-unix")!;
    expect(r).toBeDefined();
    expect(r.timestampUtc).toBeInstanceOf(Date);
    expect(isNaN(r.timestampUtc.getTime())).toBe(false);
  });

  it("timezone duplicate: +05:30 and UTC form produce the same instant → one record survives", () => {
    const { records, summary } = processCsv(FIXTURE_CSV);
    const tzRecords = records.filter((r) => r.serviceId === "svc-tz");
    // Only one should survive deduplication.
    expect(tzRecords).toHaveLength(1);
    expect(summary.duplicateRows).toBe(1);
    // The surviving record's timestamp is 14:30 UTC.
    expect(tzRecords[0].timestampUtc.toISOString()).toBe("2025-05-09T14:30:00.000Z");
  });

  // -------------------------------------------------------------------------
  // Rejected rows
  // -------------------------------------------------------------------------

  it("rejects svc-neg with NEGATIVE_LATENCY", () => {
    const { rejected } = processCsv(FIXTURE_CSV);
    const r = rejected.find((r) => r.reason === "NEGATIVE_LATENCY");
    expect(r).toBeDefined();
    expect(r!.details).toMatch(/-286/);
  });

  it("rejects svc-999 with INVALID_STATUS", () => {
    const { rejected } = processCsv(FIXTURE_CSV);
    const r = rejected.find((r) => r.reason === "INVALID_STATUS");
    expect(r).toBeDefined();
    expect(r!.details).toMatch(/999/);
  });

  it("rejected rows carry a 1-based rowNumber traceable to the source file", () => {
    const { rejected } = processCsv(FIXTURE_CSV);
    // Every rejected record must have a positive rowNumber (header = row 1).
    expect(rejected.every((r) => r.rowNumber >= 2)).toBe(true);
  });

  it("rejectionReasons aggregates counts correctly", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.rejectionReasons["NEGATIVE_LATENCY"]).toBe(1);
    expect(summary.rejectionReasons["INVALID_STATUS"]).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Date range (derived, never hardcoded)
  // -------------------------------------------------------------------------

  it("derives dateRange from accepted records — min and max are Date instances", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.dateRange).not.toBeNull();
    expect(summary.dateRange!.min).toBeInstanceOf(Date);
    expect(summary.dateRange!.max).toBeInstanceOf(Date);
  });

  it("dateRange.min is before or equal to dateRange.max", () => {
    const { summary } = processCsv(FIXTURE_CSV);
    expect(summary.dateRange!.min.getTime()).toBeLessThanOrEqual(
      summary.dateRange!.max.getTime(),
    );
  });

  // -------------------------------------------------------------------------
  // Structural failures propagate
  // -------------------------------------------------------------------------

  it("throws CsvParseError on a completely empty string", () => {
    expect(() => processCsv("")).toThrow(CsvParseError);
  });

  it("throws CsvParseError when required columns are missing from the header", () => {
    expect(() => processCsv("foo,bar\n1,2")).toThrow(CsvParseError);
  });
});
