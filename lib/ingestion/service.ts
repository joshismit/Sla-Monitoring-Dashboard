import { processCsv } from "@/lib/csv/pipeline";
import { persistPipelineResult } from "./repository";

export interface IngestionSummary {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  insertedRows: number;
  alreadyExistingRows: number;
  rejectionReasons: Record<string, number>;
}

export interface IngestionResponse {
  success: boolean;
  upload: {
    id: string;
    filename: string;
  };
  summary: IngestionSummary;
}

/**
 * Orchestrates the ingestion process for a CSV file.
 * 
 * Flow:
 * 1. Process the raw CSV string using the pure pipeline.
 * 2. Persist the cleaned records and upload metadata to the database.
 * 3. Merge processing and persistence statistics into a unified summary.
 * 
 * @param filename The original name of the uploaded file.
 * @param csvText The raw CSV content.
 * @returns An IngestionResponse combining upload IDs and metrics.
 */
export async function ingestCsv(
  filename: string,
  csvText: string
): Promise<IngestionResponse> {
  // 1. Pure Processing (Phase 2)
  const pipelineResult = processCsv(csvText);

  // 2. Persistence (Phase 3)
  const persistenceResult = await persistPipelineResult(
    filename,
    pipelineResult
  );

  // 3. Return a combined summary
  return {
    success: true,
    upload: {
      id: persistenceResult.uploadRunId,
      filename,
    },
    summary: {
      totalRows: pipelineResult.summary.totalRows,
      acceptedRows: pipelineResult.summary.acceptedRows,
      rejectedRows: pipelineResult.summary.rejectedRows,
      duplicateRows: pipelineResult.summary.duplicateRows,
      insertedRows: persistenceResult.insertedRows,
      alreadyExistingRows: persistenceResult.alreadyExistingRows,
      rejectionReasons: pipelineResult.summary.rejectionReasons,
    },
  };
}
