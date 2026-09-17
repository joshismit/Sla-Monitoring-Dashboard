import { describe, it, expect } from "vitest";
import { validateStatus } from "@/lib/pipeline/validate-status";
import type { RawRow } from "@/lib/pipeline/types";

function makeRow(
  rowIndex: number,
  statusCode?: string,
  isAvailable?: string
): RawRow {
  return {
    rowIndex,
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(isAvailable !== undefined ? { isAvailable } : {}),
  };
}

describe("validateStatus", () => {
  it("accepts a valid 2xx status and derives isAvailable=true", () => {
    const { rows, issues } = validateStatus([makeRow(0, "200")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._statusCodeParsed).toBe(200);
    expect(rows[0]._isAvailableParsed).toBe(true);
  });

  it("accepts a valid 5xx status and derives isAvailable=false", () => {
    const { rows, issues } = validateStatus([makeRow(0, "503")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._statusCodeParsed).toBe(503);
    expect(rows[0]._isAvailableParsed).toBe(false);
  });

  it("rejects a status below 100", () => {
    const { rows, issues } = validateStatus([makeRow(0, "99")]);
    expect(rows[0]._statusCodeParsed).toBeNull();
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/valid HTTP range/i);
  });

  it("rejects a status above 599", () => {
    const { rows, issues } = validateStatus([makeRow(0, "600")]);
    expect(rows[0]._statusCodeParsed).toBeNull();
    expect(issues[0].severity).toBe("error");
  });

  it("rejects a non-integer status", () => {
    const { rows, issues } = validateStatus([makeRow(0, "200.5")]);
    expect(rows[0]._statusCodeParsed).toBeNull();
    expect(issues[0].message).toMatch(/whole integer/i);
  });

  it("rejects a non-numeric status", () => {
    const { rows, issues } = validateStatus([makeRow(0, "OK")]);
    expect(rows[0]._statusCodeParsed).toBeNull();
    expect(issues[0].severity).toBe("error");
  });

  it("rejects a missing status", () => {
    const { rows, issues } = validateStatus([makeRow(0)]);
    expect(rows[0]._statusCodeParsed).toBeNull();
    expect(issues[0].message).toMatch(/missing/i);
  });

  it("uses explicit isAvailable=true from CSV", () => {
    const { rows, issues } = validateStatus([makeRow(0, "200", "true")]);
    expect(issues).toHaveLength(0);
    expect(rows[0]._isAvailableParsed).toBe(true);
  });

  it("uses explicit isAvailable=false from CSV", () => {
    const { rows, issues } = validateStatus([makeRow(0, "200", "false")]);
    expect(rows[0]._isAvailableParsed).toBe(false);
    // Mismatch warning: 200 → derived=true, explicit=false
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toMatch(/contradicts/i);
  });

  it("accepts '1' / 'yes' / 'on' as truthy isAvailable", () => {
    for (const val of ["1", "yes", "on", "YES", "Yes"]) {
      const { rows } = validateStatus([makeRow(0, "200", val)]);
      expect(rows[0]._isAvailableParsed).toBe(true);
    }
  });

  it("accepts '0' / 'no' / 'off' as falsy isAvailable", () => {
    for (const val of ["0", "no", "off"]) {
      const { rows } = validateStatus([makeRow(0, "503", val)]);
      expect(rows[0]._isAvailableParsed).toBe(false);
    }
  });

  it("warns and falls back to derived when isAvailable is unparseable", () => {
    const { rows, issues } = validateStatus([makeRow(0, "200", "maybe")]);
    expect(rows[0]._isAvailableParsed).toBe(true); // derived from 200
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toMatch(/falling back/i);
  });

  it("accepts boundary statuses 100 and 599", () => {
    const { rows: r1 } = validateStatus([makeRow(0, "100")]);
    const { rows: r2 } = validateStatus([makeRow(1, "599")]);
    expect(r1[0]._statusCodeParsed).toBe(100);
    expect(r2[0]._statusCodeParsed).toBe(599);
  });
});
