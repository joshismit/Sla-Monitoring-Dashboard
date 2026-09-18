import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import * as service from "@/lib/ingestion/service";
import { CsvParseError } from "@/lib/csv/pipeline";

// Mock the ingestion service
vi.mock("@/lib/ingestion/service", () => ({
  ingestCsv: vi.fn(),
}));

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequestWithFormData(file?: File | string | null): NextRequest {
    const formData = new FormData();
    if (file !== undefined && file !== null) {
      formData.append("file", file as any);
    }

    // Creating a dummy Request just to pass formData to NextRequest
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    
    // We can't directly use NextRequest in node sometimes without next/server context
    // but a Request works identically for formData(). 
    // We cast to NextRequest to satisfy the TS signature.
    return req as unknown as NextRequest;
  }

  it("returns 400 if no file is provided", async () => {
    const request = createRequestWithFormData();
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/CSV file is required/i);
  });

  it("returns 400 if file is provided but it's not a File object", async () => {
    const request = createRequestWithFormData("just a string");
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/CSV file is required/i);
  });

  it("returns 400 if file extension is not .csv", async () => {
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const request = createRequestWithFormData(file);
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/Only CSV files are allowed/i);
  });

  it("returns 400 if file is too large", async () => {
    // 11 MB file mock
    const file = new File(["a".repeat(11 * 1024 * 1024)], "test.csv", { type: "text/csv" });
    const request = createRequestWithFormData(file);
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/exceeds the maximum allowed size/i);
  });

  it("returns 400 if ingestion throws CsvParseError", async () => {
    vi.mocked(service.ingestCsv).mockRejectedValueOnce(new CsvParseError("Missing columns"));
    
    const file = new File(["bad data"], "test.csv", { type: "text/csv" });
    const request = createRequestWithFormData(file);
    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/Invalid CSV format/i);
  });

  it("returns 500 if ingestion throws unknown error (e.g. database error)", async () => {
    vi.mocked(service.ingestCsv).mockRejectedValueOnce(new Error("PrismaClientKnownRequestError"));
    
    const file = new File(["data"], "test.csv", { type: "text/csv" });
    const request = createRequestWithFormData(file);
    const response = await POST(request);
    
    expect(response.status).toBe(500);
    const json = await response.json();
    // Verify we do NOT leak internal Prisma details
    expect(json.error).toBe("An internal server error occurred while processing the upload");
  });

  it("returns 201 with summary on successful ingestion", async () => {
    vi.mocked(service.ingestCsv).mockResolvedValueOnce({
      success: true,
      upload: { id: "123", filename: "test.csv" },
      summary: {
        totalRows: 1,
        acceptedRows: 1,
        rejectedRows: 0,
        duplicateRows: 0,
        insertedRows: 1,
        alreadyExistingRows: 0,
        rejectionReasons: {},
      },
    });
    
    const file = new File(["valid,csv"], "test.csv", { type: "text/csv" });
    const request = createRequestWithFormData(file);
    const response = await POST(request);
    
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.upload.id).toBe("123");
  });
});
