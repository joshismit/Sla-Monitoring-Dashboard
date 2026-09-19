import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    healthCheck: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with paginated logs and default parameters", async () => {
    vi.mocked(prisma.healthCheck.count).mockResolvedValueOnce(150);
    vi.mocked(prisma.healthCheck.findMany).mockResolvedValueOnce([
      { id: "1", serviceName: "API" },
      { id: "2", serviceName: "DB" },
    ] as any);

    const request = new Request("http://localhost:3000/api/logs");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    
    expect(json.data).toHaveLength(2);
    expect(json.pagination.total).toBe(150);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.pageSize).toBe(50);
    expect(json.pagination.totalPages).toBe(3);

    // Verify findMany was called with default skip/take
    expect(prisma.healthCheck.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 50,
      orderBy: { timestampUtc: "desc" }
    });
  });

  it("applies filters correctly", async () => {
    vi.mocked(prisma.healthCheck.count).mockResolvedValueOnce(10);
    vi.mocked(prisma.healthCheck.findMany).mockResolvedValueOnce([] as any);

    const request = new Request("http://localhost:3000/api/logs?service=API&status=200&availability=true&startDate=2023-01-01T00:00:00Z&endDate=2023-01-02T00:00:00Z&page=2&pageSize=20");
    const response = await GET(request);

    expect(response.status).toBe(200);
    
    expect(prisma.healthCheck.findMany).toHaveBeenCalledWith({
      where: {
        serviceName: "API",
        statusCode: 200,
        isAvailable: true,
        timestampUtc: {
          gte: new Date("2023-01-01T00:00:00Z"),
          lte: new Date("2023-01-02T00:00:00Z"),
        }
      },
      skip: 20,
      take: 20,
      orderBy: { timestampUtc: "desc" }
    });
  });

  it("handles parsing errors in query parameters gracefully", async () => {
    vi.mocked(prisma.healthCheck.count).mockResolvedValueOnce(10);
    vi.mocked(prisma.healthCheck.findMany).mockResolvedValueOnce([] as any);

    const request = new Request("http://localhost:3000/api/logs?status=invalid&page=-5&pageSize=500");
    const response = await GET(request);

    expect(response.status).toBe(200);
    
    // Page becomes 1 (Math.max(1, -5))
    // pageSize becomes 100 (Math.min(100, Math.max(1, 500)))
    expect(prisma.healthCheck.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 100,
    }));
    // status isn't applied since 'invalid' is NaN
    const callArgs = vi.mocked(prisma.healthCheck.findMany).mock.calls[0][0];
    expect((callArgs as any).where.statusCode).toBeUndefined();
  });

  it("returns 500 on database error", async () => {
    vi.mocked(prisma.healthCheck.count).mockRejectedValueOnce(new Error("DB Error"));

    const request = new Request("http://localhost:3000/api/logs");
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});
