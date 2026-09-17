import { describe, it, expect } from "vitest";
import { mapColumns } from "@/lib/pipeline/map-columns";
import type { ParsedCSV } from "@/lib/pipeline/parse-csv";

function makeParsed(headers: string[], rows: string[][]): ParsedCSV {
  return { headers, rows };
}

describe("mapColumns", () => {
  it("maps canonical aliases correctly", () => {
    const parsed = makeParsed(
      ["service_id", "service_name", "timestamp_utc", "status_code", "latency_ms", "agent", "region"],
      [["svc-1", "Alpha", "2024-01-01T00:00:00Z", "200", "42", "bot", "us-east"]]
    );
    const { rows, unknownColumns } = mapColumns(parsed);
    expect(unknownColumns).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      rowIndex: 0,
      serviceId: "svc-1",
      serviceName: "Alpha",
      timestampUtc: "2024-01-01T00:00:00Z",
      statusCode: "200",
      latencyMs: "42",
      agent: "bot",
      region: "us-east",
    });
  });

  it("is case-insensitive and ignores underscores/spaces", () => {
    const parsed = makeParsed(
      ["SERVICE_ID", "Service Name", "HTTP STATUS"],
      [["s1", "Svc", "404"]]
    );
    const { rows } = mapColumns(parsed);
    expect(rows[0].serviceId).toBe("s1");
    expect(rows[0].serviceName).toBe("Svc");
    expect(rows[0].statusCode).toBe("404");
  });

  it("collects unknown columns", () => {
    const parsed = makeParsed(
      ["service_id", "foo_bar", "baz"],
      [["s1", "x", "y"]]
    );
    const { unknownColumns } = mapColumns(parsed);
    expect(unknownColumns).toContain("foo_bar");
    expect(unknownColumns).toContain("baz");
  });

  it("treats empty cell values as absent (field not set on row)", () => {
    const parsed = makeParsed(
      ["service_id", "latency_ms"],
      [["svc-1", ""]]
    );
    const { rows } = mapColumns(parsed);
    expect(rows[0].latencyMs).toBeUndefined();
  });

  it("assigns correct rowIndex starting at 0", () => {
    const parsed = makeParsed(["service_id"], [["a"], ["b"], ["c"]]);
    const { rows } = mapColumns(parsed);
    expect(rows.map((r) => r.rowIndex)).toEqual([0, 1, 2]);
  });

  it("accepts 'name' alias for serviceName", () => {
    const parsed = makeParsed(["id", "name"], [["s1", "My Service"]]);
    const { rows } = mapColumns(parsed);
    expect(rows[0].serviceId).toBe("s1");
    expect(rows[0].serviceName).toBe("My Service");
  });
});
