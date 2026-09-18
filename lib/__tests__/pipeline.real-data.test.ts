import { describe, it, expect } from "vitest";
import { processCsv } from "@/lib/csv/pipeline";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Real-data fixture
//
// This mirrors the structure of the assignment CSV dataset:
//   - 5 services (api-gateway, auth-service, db-primary, cache, worker)
//   - 2 agents   (bot-a, bot-b)
//   - 3 regions  (us-east-1, eu-west-1, ap-south-1)
//   - 9-day span (2025-05-09 → 2025-05-17)
//   - Mix of statuses: 200, 500, 502, 503
//   - Latency in ms and seconds
//   - Missing latency rows
//   - Unix epoch timestamps
//   - Timezone-offset timestamps (IST +05:30)
//   - A duplicate row
//   - A negative latency row  → rejected
//   - A 999 status row        → rejected
//
// When the real CSV is added at data/health_checks.csv, the second
// describe block runs real-file assertions in addition to these.
// ---------------------------------------------------------------------------

const REPRESENTATIVE_CSV = `service_id,service_name,timestamp,status_code,latency_ms,agent,region
svc-api-gateway,API Gateway,2025-05-09T10:00:00Z,200,142ms,bot-a,us-east-1
svc-auth,Auth Service,2025-05-09T10:00:00Z,503,350ms,bot-a,us-east-1
svc-db,DB Primary,2025-05-09T10:00:00Z,200,0.717s,bot-b,eu-west-1
svc-cache,Cache,2025-05-09T10:00:00Z,200,50ms,bot-a,ap-south-1
svc-worker,Worker,1746791400,200,100ms,bot-b,ap-south-1
svc-api-gateway,API Gateway,2025-05-09T15:30:00+05:30,200,142ms,bot-a,us-east-1
svc-api-gateway,API Gateway,2025-05-09T10:00:00Z,200,142ms,bot-a,us-east-1
svc-auth,Auth Service,2025-05-10T10:00:00Z,502,280ms,bot-a,us-east-1
svc-db,DB Primary,2025-05-10T10:00:00Z,200,,bot-b,eu-west-1
svc-cache,Cache,2025-05-11T10:00:00Z,200,-50ms,bot-a,ap-south-1
svc-worker,Worker,2025-05-11T10:00:00Z,999,100ms,bot-b,ap-south-1
svc-auth,Auth Service,2025-05-17T10:00:00Z,500,400ms,bot-a,us-east-1`;

// Row accounting for the fixture above:
//   row 2  svc-api-gateway  UTC          → accepted
//   row 3  svc-auth 503                  → accepted (unavailable)
//   row 4  svc-db   0.717s               → accepted, latencyMs=717
//   row 5  svc-cache ap-south-1          → accepted
//   row 6  svc-worker Unix epoch         → accepted
//   row 7  svc-api-gateway +05:30 = row2 → duplicate (same instant)
//   row 8  svc-api-gateway exact dup     → duplicate
//   row 9  svc-auth 502                  → accepted
//   row 10 svc-db missing latency        → accepted, latencyMs=null
//   row 11 svc-cache negative latency    → rejected NEGATIVE_LATENCY
//   row 12 svc-worker 999 status         → rejected INVALID_STATUS
//   row 13 svc-auth 500 (day 17)         → accepted
//
// totalRows=12, acceptedRows=8, rejectedRows=2, duplicateRows=2

describe("processCsv — representative fixture (mirrors real dataset shape)", () => {
  it("processes all 12 rows", () => {
    const { summary } = processCsv(REPRESENTATIVE_CSV);
    expect(summary.totalRows).toBe(12);
  });

  it("accounting: accepted + rejected + duplicates = totalRows", () => {
    const { summary } = processCsv(REPRESENTATIVE_CSV);
    expect(summary.acceptedRows + summary.rejectedRows + summary.duplicateRows)
      .toBe(summary.totalRows);
  });

  it("rejects 2 rows (negative latency + invalid status)", () => {
    const { summary } = processCsv(REPRESENTATIVE_CSV);
    expect(summary.rejectedRows).toBe(2);
  });

  it("removes 2 duplicates (UTC+05:30 form and exact copy)", () => {
    const { summary } = processCsv(REPRESENTATIVE_CSV);
    expect(summary.duplicateRows).toBe(2);
  });

  it("discovers 5 distinct services", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const services = new Set(records.map((r) => r.serviceId));
    expect(services.size).toBe(5);
  });

  it("discovers 2 distinct agents", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const agents = new Set(records.map((r) => r.agent));
    expect(agents.size).toBe(2);
    expect(agents).toContain("bot-a");
    expect(agents).toContain("bot-b");
  });

  it("discovers ap-south-1 region", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const regions = new Set(records.map((r) => r.region));
    expect(regions).toContain("ap-south-1");
  });

  it("derives a 9-day date range from the data (never hardcoded)", () => {
    const { summary } = processCsv(REPRESENTATIVE_CSV);
    expect(summary.dateRange).not.toBeNull();
    const { min, max } = summary.dateRange!;
    const spanDays = (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24);
    // Fixture spans 2025-05-09 → 2025-05-17 = 8 days difference, which rounds
    // to roughly 8 days. The important thing: it is derived from the data.
    expect(spanDays).toBeGreaterThan(7);
    expect(spanDays).toBeLessThan(10);
  });

  it("503 service is marked unavailable", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const r = records.find((r) => r.statusCode === 503);
    expect(r).toBeDefined();
    expect(r!.isAvailable).toBe(false);
  });

  it("200 service is marked available", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const r = records.find((r) => r.statusCode === 200);
    expect(r).toBeDefined();
    expect(r!.isAvailable).toBe(true);
  });

  it("converts 0.717s → 717ms (no rounding)", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const r = records.find((r) => r.latencyMs === 717);
    expect(r).toBeDefined();
  });

  it("retains missing-latency rows with latencyMs=null", () => {
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const nullLatency = records.filter((r) => r.latencyMs === null);
    expect(nullLatency.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects negative latency with NEGATIVE_LATENCY reason", () => {
    const { rejected } = processCsv(REPRESENTATIVE_CSV);
    expect(rejected.some((r) => r.reason === "NEGATIVE_LATENCY")).toBe(true);
  });

  it("rejects status 999 with INVALID_STATUS reason", () => {
    const { rejected } = processCsv(REPRESENTATIVE_CSV);
    expect(rejected.some((r) => r.reason === "INVALID_STATUS")).toBe(true);
  });

  it("timezone-equivalent duplicate is correctly collapsed", () => {
    // The +05:30 row and its UTC equivalent must count as one record.
    const { records } = processCsv(REPRESENTATIVE_CSV);
    const apiGatewayAtTen = records.filter(
      (r) =>
        r.serviceId === "svc-api-gateway" &&
        r.timestampUtc.toISOString() === "2025-05-09T10:00:00.000Z" &&
        r.agent === "bot-a" &&
        r.region === "us-east-1",
    );
    expect(apiGatewayAtTen).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Real CSV file — skipped gracefully when the file is not present.
//
// Add the assignment CSV to:  data/health_checks.csv
// (relative to the project root)
//
// Once added, this block runs structural assertions without locking in
// exact row counts, so it survives minor data corrections.
// ---------------------------------------------------------------------------

const REAL_CSV_PATH = path.resolve(
  process.cwd(),
  "data",
  "health_checks.csv",
);
const realFileExists = fs.existsSync(REAL_CSV_PATH);

describe.skipIf(!realFileExists)(
  "processCsv — real dataset (data/health_checks.csv)",
  () => {
    let csvText: string;

    // Load once — file I/O is expensive; no need to repeat per-test.
    try {
      csvText = fs.readFileSync(REAL_CSV_PATH, "utf-8");
    } catch {
      csvText = "";
    }

    it("parses without throwing a CsvParseError", () => {
      expect(() => processCsv(csvText)).not.toThrow();
    });

    it("totalRows matches accepted + rejected + duplicates", () => {
      const { summary } = processCsv(csvText);
      expect(summary.acceptedRows + summary.rejectedRows + summary.duplicateRows)
        .toBe(summary.totalRows);
    });

    it("discovers exactly 5 distinct services", () => {
      const { records } = processCsv(csvText);
      const services = new Set(records.map((r) => r.serviceId));
      expect(services.size).toBe(5);
    });

    it("discovers exactly 2 distinct agents", () => {
      const { records } = processCsv(csvText);
      const agents = new Set(records.map((r) => r.agent));
      expect(agents.size).toBe(2);
    });

    it("includes ap-south-1 in the discovered regions", () => {
      const { records } = processCsv(csvText);
      const regions = new Set(records.map((r) => r.region));
      expect(regions).toContain("ap-south-1");
    });

    it("date range spans roughly 9 days (2025-05-09 → 2025-05-17)", () => {
      const { summary } = processCsv(csvText);
      expect(summary.dateRange).not.toBeNull();
      const { min, max } = summary.dateRange!;
      const spanDays = (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24);
      // Allow ±1 day tolerance for data at the boundaries.
      expect(spanDays).toBeGreaterThan(7);
      expect(spanDays).toBeLessThan(11);
    });

    it("rejects invalid status codes (INVALID_STATUS)", () => {
      const { rejected } = processCsv(csvText);
      expect(rejected.some((r) => r.reason === "INVALID_STATUS")).toBe(true);
    });

    it("rejects negative latency rows (NEGATIVE_LATENCY)", () => {
      const { rejected } = processCsv(csvText);
      expect(rejected.some((r) => r.reason === "NEGATIVE_LATENCY")).toBe(true);
    });

    it("removes duplicates", () => {
      const { summary } = processCsv(csvText);
      expect(summary.duplicateRows).toBeGreaterThan(0);
    });

    it("retains rows with missing latency (latencyMs=null)", () => {
      const { records } = processCsv(csvText);
      expect(records.some((r) => r.latencyMs === null)).toBe(true);
    });

    it("every accepted record has a valid Date for timestampUtc", () => {
      const { records } = processCsv(csvText);
      expect(records.every((r) => r.timestampUtc instanceof Date && !isNaN(r.timestampUtc.getTime())))
        .toBe(true);
    });

    it("every accepted record has isAvailable as a boolean", () => {
      const { records } = processCsv(csvText);
      expect(records.every((r) => typeof r.isAvailable === "boolean")).toBe(true);
    });

    it("no accepted record has a statusCode outside [100, 599]", () => {
      const { records } = processCsv(csvText);
      expect(records.every((r) => r.statusCode >= 100 && r.statusCode <= 599)).toBe(true);
    });

    it("no accepted record has a negative latencyMs", () => {
      const { records } = processCsv(csvText);
      expect(records.every((r) => r.latencyMs === null || r.latencyMs >= 0)).toBe(true);
    });
  },
);
