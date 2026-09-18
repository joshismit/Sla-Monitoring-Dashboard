import { describe, it, expect } from "vitest";
import { processCsv } from "@/lib/csv/pipeline";
import type { CleanHealthCheck } from "@/lib/csv/types";

// ---------------------------------------------------------------------------
// Deduplication is tested via the full pipeline so that the timestamp
// normalisation → deduplication ordering is exercised end-to-end.
//
// The unit-level key function is an implementation detail; what matters is
// the observable behaviour: which records survive and which are discarded.
// ---------------------------------------------------------------------------

function makeRow(
  serviceId: string,
  timestamp: string,
  agent = "bot-a",
  region = "us-east",
  status = "200",
  latency = "100",
): string {
  return `${serviceId},Service ${serviceId},${timestamp},${status},${latency},${agent},${region}`;
}

const HEADER = "service_id,service_name,timestamp,status_code,latency_ms,agent,region";

function buildCsv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// Unique records retained
// ---------------------------------------------------------------------------

describe("deduplicator (via pipeline)", () => {
  it("retains unique records", () => {
    const csv = buildCsv(
      makeRow("svc-1", "2025-05-09T14:30:00Z"),
      makeRow("svc-2", "2025-05-09T14:30:00Z"),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(2);
    expect(summary.duplicateRows).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Exact duplicate removed
  // -------------------------------------------------------------------------

  it("removes an exact duplicate (same service, timestamp, agent, region)", () => {
    const row = makeRow("svc-1", "2025-05-09T14:30:00Z");
    const csv = buildCsv(row, row);
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(1);
    expect(summary.duplicateRows).toBe(1);
  });

  it("keeps the first occurrence when a duplicate is found", () => {
    const csv = buildCsv(
      makeRow("svc-1", "2025-05-09T14:30:00Z", "bot-a", "us-east", "200", "50"),
      makeRow("svc-1", "2025-05-09T14:30:00Z", "bot-a", "us-east", "200", "999"),
    );
    const { records } = processCsv(csv);
    expect(records[0].latencyMs).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Normalised timestamp duplicate — the key invariant
  // -------------------------------------------------------------------------

  it("treats timezone-equivalent timestamps as duplicates after normalisation", () => {
    // "2025-05-09T14:30:00Z" and "2025-05-09T20:00:00+05:30" are the same instant.
    // String comparison: different → would survive as two records.  ❌
    // Date comparison after normalisation: same → correctly deduplicated. ✅
    const csv = buildCsv(
      makeRow("svc-1", "2025-05-09T14:30:00Z"),
      makeRow("svc-1", "2025-05-09T20:00:00+05:30"),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(1);
    expect(summary.duplicateRows).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Key components: different agent, region, service → NOT duplicates
  // -------------------------------------------------------------------------

  it("retains records with different agents as distinct", () => {
    const ts = "2025-05-09T14:30:00Z";
    const csv = buildCsv(
      makeRow("svc-1", ts, "bot-a"),
      makeRow("svc-1", ts, "bot-b"),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(2);
    expect(summary.duplicateRows).toBe(0);
  });

  it("retains records with different regions as distinct", () => {
    const ts = "2025-05-09T14:30:00Z";
    const csv = buildCsv(
      makeRow("svc-1", ts, "bot-a", "us-east"),
      makeRow("svc-1", ts, "bot-a", "eu-west"),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(2);
    expect(summary.duplicateRows).toBe(0);
  });

  it("retains records with different serviceIds as distinct", () => {
    const ts = "2025-05-09T14:30:00Z";
    const csv = buildCsv(
      makeRow("svc-1", ts),
      makeRow("svc-2", ts),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(2);
    expect(summary.duplicateRows).toBe(0);
  });

  it("retains records with different timestamps as distinct", () => {
    const csv = buildCsv(
      makeRow("svc-1", "2025-05-09T14:30:00Z"),
      makeRow("svc-1", "2025-05-09T14:31:00Z"),
    );
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(2);
    expect(summary.duplicateRows).toBe(0);
  });

  it("handles three copies: keeps one, counts two duplicates", () => {
    const row = makeRow("svc-1", "2025-05-09T14:30:00Z");
    const csv = buildCsv(row, row, row);
    const { records, summary } = processCsv(csv);
    expect(records).toHaveLength(1);
    expect(summary.duplicateRows).toBe(2);
  });
});
