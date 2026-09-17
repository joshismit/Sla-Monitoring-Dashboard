import { describe, it, expect } from "vitest";
import { parseCSV } from "@/lib/pipeline/parse-csv";

describe("parseCSV", () => {
  it("parses a well-formed CSV", () => {
    const csv = `service_id,service_name,timestamp
svc-1,Alpha,2024-01-01T00:00:00Z`;
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["service_id", "service_name", "timestamp"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(["svc-1", "Alpha", "2024-01-01T00:00:00Z"]);
  });

  it("trims whitespace from headers and cells", () => {
    const csv = `  id  ,  name  \n  v1  ,  My Service  `;
    const { headers, rows } = parseCSV(csv);
    expect(headers).toEqual(["id", "name"]);
    expect(rows[0]).toEqual(["v1", "My Service"]);
  });

  it("skips empty lines", () => {
    const csv = `id,name\n\nsvc-1,Alpha\n\nsvc-2,Beta`;
    const { rows } = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it("tolerates rows with fewer columns than the header (relax_column_count)", () => {
    const csv = `id,name,ts\nsvc-1,Alpha`;
    const { rows } = parseCSV(csv);
    expect(rows[0]).toEqual(["svc-1", "Alpha"]);
  });

  it("throws on empty input", () => {
    expect(() => parseCSV("")).toThrow();
  });

  it("throws when there are no data rows", () => {
    expect(() => parseCSV("id,name")).toThrow(/no data rows/i);
  });

  it("accepts a Buffer", () => {
    const buf = Buffer.from("id,name\nsvc-1,Alpha");
    const { headers, rows } = parseCSV(buf);
    expect(headers).toEqual(["id", "name"]);
    expect(rows).toHaveLength(1);
  });
});
