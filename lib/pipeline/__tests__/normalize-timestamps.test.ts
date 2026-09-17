import { describe, it, expect } from "vitest";
import { normalizeTimestamps } from "@/lib/pipeline/normalize-timestamps";
import type { RawRow } from "@/lib/pipeline/types";

function makeRow(rowIndex: number, timestampUtc?: string): RawRow {
  return { rowIndex, ...(timestampUtc !== undefined ? { timestampUtc } : {}) };
}

describe("normalizeTimestamps", () => {
  it("parses ISO 8601 with Z suffix", () => {
    const { rows, issues } = normalizeTimestamps([
      makeRow(0, "2024-03-15T12:30:00Z"),
    ]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._timestampParsed).toBeInstanceOf(Date);
    expect(rows[0]._timestampParsed!.toISOString()).toBe("2024-03-15T12:30:00.000Z");
  });

  it("parses ISO 8601 with positive timezone offset", () => {
    const { rows, issues } = normalizeTimestamps([
      makeRow(0, "2024-03-15T17:30:00+05:30"),
    ]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._timestampParsed!.toISOString()).toBe("2024-03-15T12:00:00.000Z");
  });

  it("parses 'yyyy-MM-dd HH:mm:ss' as UTC", () => {
    const { rows, issues } = normalizeTimestamps([
      makeRow(0, "2024-03-15 12:30:00"),
    ]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._timestampParsed!.toISOString()).toBe("2024-03-15T12:30:00.000Z");
  });

  it("parses 'yyyy-MM-ddTHH:mm:ss' (no tz) as UTC", () => {
    const { rows } = normalizeTimestamps([makeRow(0, "2024-03-15T12:30:00")]);
    expect(rows[0]._timestampParsed!.toISOString()).toBe("2024-03-15T12:30:00.000Z");
  });

  it("parses with milliseconds", () => {
    const { rows } = normalizeTimestamps([makeRow(0, "2024-03-15 12:30:00.456")]);
    expect(rows[0]._timestampParsed!.getUTCMilliseconds()).toBe(456);
  });

  it("parses unix epoch seconds (< 1e10)", () => {
    const { rows, issues } = normalizeTimestamps([makeRow(0, "1710503400")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._timestampParsed).toBeInstanceOf(Date);
    // 1710503400 * 1000 = valid date
    expect(rows[0]._timestampParsed!.getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it("parses unix epoch milliseconds (>= 1e10)", () => {
    const { rows, issues } = normalizeTimestamps([makeRow(0, "1710503400000")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._timestampParsed).toBeInstanceOf(Date);
  });

  it("flags unparseable timestamps as error", () => {
    const { rows, issues } = normalizeTimestamps([makeRow(0, "not-a-date")]);
    expect(rows[0]._timestampParsed).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].field).toBe("timestampUtc");
  });

  it("flags missing timestamp as error", () => {
    const { rows, issues } = normalizeTimestamps([makeRow(0)]);
    expect(rows[0]._timestampParsed).toBeNull();
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/missing/i);
  });

  it("processes multiple rows independently", () => {
    const { rows, issues } = normalizeTimestamps([
      makeRow(0, "2024-01-01T00:00:00Z"),
      makeRow(1, "bad"),
      makeRow(2, "2024-06-01T00:00:00Z"),
    ]);
    expect(rows[0]._timestampParsed).not.toBeNull();
    expect(rows[1]._timestampParsed).toBeNull();
    expect(rows[2]._timestampParsed).not.toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0].rowIndex).toBe(1);
  });
});
