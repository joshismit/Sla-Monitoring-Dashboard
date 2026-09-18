import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestCsv } from "@/lib/ingestion/service";
import * as repository from "@/lib/ingestion/repository";
import { CsvParseError } from "@/lib/csv/pipeline";

// Mock the entire repository module so we don't hit the real database
vi.mock("@/lib/ingestion/repository", () => ({
  persistPipelineResult: vi.fn(),
}));

describe("ingestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validCsv = `service_id,service_name,timestamp,status_code,latency_ms,agent,region
svc-1,Alpha,2025-05-09T10:00:00Z,200,100ms,bot,us-east`;

  const invalidCsv = `service_id,service_name,timestamp,status_code,latency_ms,agent,region
svc-1,Alpha,2025-05-09T10:00:00Z,999,100ms,bot,us-east`; // 999 is invalid

  it("processes a valid CSV and calls the repository", async () => {
    // Setup mock return
    vi.mocked(repository.persistPipelineResult).mockResolvedValueOnce({
      uploadRunId: "test-run-123",
      insertedRows: 1,
      alreadyExistingRows: 0,
    });

    const result = await ingestCsv("test.csv", validCsv);

    expect(repository.persistPipelineResult).toHaveBeenCalledTimes(1);
    
    // Check the service successfully bridged pipeline stats with persistence stats
    expect(result.success).toBe(true);
    expect(result.upload.id).toBe("test-run-123");
    expect(result.summary.acceptedRows).toBe(1);
    expect(result.summary.rejectedRows).toBe(0);
    expect(result.summary.insertedRows).toBe(1);
  });

  it("handles CSV with rejected rows and still persists the accepted ones", async () => {
    vi.mocked(repository.persistPipelineResult).mockResolvedValueOnce({
      uploadRunId: "test-run-124",
      insertedRows: 0, // none accepted
      alreadyExistingRows: 0,
    });

    const result = await ingestCsv("test.csv", invalidCsv);

    expect(repository.persistPipelineResult).toHaveBeenCalledTimes(1);
    expect(result.summary.acceptedRows).toBe(0);
    expect(result.summary.rejectedRows).toBe(1);
    expect(result.summary.rejectionReasons["INVALID_STATUS"]).toBe(1);
  });

  it("throws CsvParseError for fundamentally malformed CSV", async () => {
    const malformed = `col1,col2\nval1,val2`;

    await expect(ingestCsv("test.csv", malformed)).rejects.toThrow(CsvParseError);
    // Repository should never be called if parsing fails completely
    expect(repository.persistPipelineResult).not.toHaveBeenCalled();
  });
});
