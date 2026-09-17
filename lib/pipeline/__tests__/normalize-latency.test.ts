import { describe, it, expect } from "vitest";
import { normalizeLatency } from "@/lib/pipeline/normalize-latency";
import type { RawRow } from "@/lib/pipeline/types";

function makeRow(rowIndex: number, latencyMs?: string): RawRow {
  return { rowIndex, ...(latencyMs !== undefined ? { latencyMs } : {}) };
}

describe("normalizeLatency", () => {
  it("parses a plain numeric string", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "142")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBe(142);
  });

  it("parses a float", () => {
    const { rows } = normalizeLatency([makeRow(0, "142.7")]);
    expect(rows[0]._latencyParsed).toBeCloseTo(142.7);
  });

  it("strips 'ms' suffix (lowercase)", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "200ms")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBe(200);
  });

  it("strips 'MS' suffix (uppercase)", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "200MS")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBe(200);
  });

  it("strips 'ms' suffix with spaces", () => {
    const { rows } = normalizeLatency([makeRow(0, " 99.5 ms")]);
    expect(rows[0]._latencyParsed).toBeCloseTo(99.5);
  });

  it("returns null (no issue) when latencyMs is absent", () => {
    const { rows, issues } = normalizeLatency([makeRow(0)]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBeNull();
  });

  it("returns null (no issue) when latencyMs is empty string (after mapping)", () => {
    // mapColumns already strips empty → undefined, but test the empty string path too
    const { rows, issues } = normalizeLatency([{ rowIndex: 0, latencyMs: "" }]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBeNull();
  });

  it("warns and returns null for a negative value", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "-5")]);
    expect(rows[0]._latencyParsed).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toMatch(/negative/i);
  });

  it("warns and returns null for a non-numeric string", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "fast")]);
    expect(rows[0]._latencyParsed).toBeNull();
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toMatch(/Cannot parse/i);
  });

  it("warns for 'ms' with no numeric part", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "ms")]);
    expect(rows[0]._latencyParsed).toBeNull();
    expect(issues[0].message).toMatch(/no numeric component/i);
  });

  it("processes zero correctly (valid)", () => {
    const { rows, issues } = normalizeLatency([makeRow(0, "0")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._latencyParsed).toBe(0);
  });
});
