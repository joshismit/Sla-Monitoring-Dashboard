import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    healthCheck: {
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with aggregated stats", async () => {
    vi.mocked(prisma.healthCheck.count)
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(90)  // available
      .mockResolvedValueOnce(10); // failed

    vi.mocked(prisma.healthCheck.groupBy).mockResolvedValueOnce([
      { serviceName: "API" },
      { serviceName: "DB" },
    ] as any);

    vi.mocked(prisma.healthCheck.aggregate).mockResolvedValueOnce({
      _min: { timestampUtc: new Date("2023-01-01T00:00:00Z") },
      _max: { timestampUtc: new Date("2023-01-02T00:00:00Z") },
    } as any);

    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { serviceName: "API", totalChecks: 50n, availableChecks: 45n, failedChecks: 5n },
      { serviceName: "DB", totalChecks: 50n, availableChecks: 45n, failedChecks: 5n },
    ]);

    const request = new Request("http://localhost:3000/api/stats");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    
    expect(json.totalHealthChecks).toBe(100);
    expect(json.availableChecks).toBe(90);
    expect(json.failedChecks).toBe(10);
    expect(json.overallAvailabilityPercentage).toBe(90);
    expect(json.servicesMonitored).toBe(2);
    expect(json.monitoringStart).toBe("2023-01-01T00:00:00.000Z");
    expect(json.perServiceStats).toHaveLength(2);
    expect(json.perServiceStats[0].serviceName).toBe("API");
    expect(json.perServiceStats[0].totalChecks).toBe(50);
  });

  it("handles empty database", async () => {
    vi.mocked(prisma.healthCheck.count)
      .mockResolvedValueOnce(0) // total
      .mockResolvedValueOnce(0)  // available
      .mockResolvedValueOnce(0); // failed

    vi.mocked(prisma.healthCheck.groupBy).mockResolvedValueOnce([]);

    vi.mocked(prisma.healthCheck.aggregate).mockResolvedValueOnce({
      _min: { timestampUtc: null },
      _max: { timestampUtc: null },
    } as any);

    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

    const request = new Request("http://localhost:3000/api/stats");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    
    expect(json.totalHealthChecks).toBe(0);
    expect(json.overallAvailabilityPercentage).toBe(0);
    expect(json.monitoringStart).toBeNull();
    expect(json.perServiceStats).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    vi.mocked(prisma.healthCheck.count).mockRejectedValueOnce(new Error("DB Error"));

    const request = new Request("http://localhost:3000/api/stats");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});
