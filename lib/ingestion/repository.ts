import { prisma } from "@/lib/db/prisma";
import type { PipelineResult } from "@/lib/csv/types";

export interface PersistenceResult {
  uploadRunId: string;
  insertedRows: number;
  alreadyExistingRows: number;
}

/**
 * Persists the results of the CSV pipeline to the database inside a single transaction.
 *
 * @param filename The original name of the uploaded file.
 * @param pipelineResult The result object from processCsv().
 * @returns A PersistenceResult containing the database insertion stats.
 */
export async function persistPipelineResult(
  filename: string,
  pipelineResult: PipelineResult
): Promise<PersistenceResult> {
  // Use a transaction to ensure atomicity. If anything fails, the entire upload rolls back.
  return prisma.$transaction(async (tx) => {
    // 1. Create the UploadRun record
    const uploadRun = await tx.uploadRun.create({
      data: {
        filename,
        totalRows: pipelineResult.summary.totalRows,
        acceptedRows: pipelineResult.summary.acceptedRows,
        rejectedRows: pipelineResult.summary.rejectedRows,
        duplicateRows: pipelineResult.summary.duplicateRows,
        status: "COMPLETED", // Assuming synchronous processing success
      },
    });

    // 2. Map domain records to database records explicitly
    const healthCheckData = pipelineResult.records.map((record) => ({
      uploadRunId: uploadRun.id,
      serviceId: record.serviceId,
      serviceName: record.serviceName,
      timestampUtc: record.timestampUtc,
      statusCode: record.statusCode,
      latencyMs: record.latencyMs,
      agent: record.agent,
      region: record.region,
      isAvailable: record.isAvailable,
    }));

    let insertedRows = 0;

    // 3. Insert cleanly, skipping duplicates
    // Using skipDuplicates: true ensures that repeated uploads are idempotent
    // and don't fail the entire transaction when PostgreSQL unique constraints hit.
    if (healthCheckData.length > 0) {
      const createResult = await tx.healthCheck.createMany({
        data: healthCheckData,
        skipDuplicates: true,
      });
      insertedRows = createResult.count;
    }

    const alreadyExistingRows = pipelineResult.records.length - insertedRows;

    return {
      uploadRunId: uploadRun.id,
      insertedRows,
      alreadyExistingRows,
    };
  });
}
