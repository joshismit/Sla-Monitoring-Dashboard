/**
 * lib/pipeline/deduplicate.ts
 *
 * Stage 7: Remove duplicate HealthCheck records.
 *
 * Unique key: (serviceId, timestampUtc ISO string, agent, region)
 * Mirrors the @@unique constraint in the Prisma schema:
 *   @@unique([serviceId, timestampUtc, agent, region])
 *
 * Strategy: first occurrence wins; subsequent occurrences are counted
 * and their rowIndex values collected for reporting.
 */

import type { HealthCheckRecord, RowIssue } from "./types";

export interface DeduplicateResult {
  records: HealthCheckRecord[];
  issues: RowIssue[];
  duplicateCount: number;
}

function buildKey(r: HealthCheckRecord): string {
  return [
    r.serviceId,
    r.timestampUtc.toISOString(),
    r.agent,
    r.region,
  ].join("\x00"); // use null byte as delimiter to avoid false collisions
}

/**
 * Deduplicates records using the composite unique key.
 *
 * @param records - Valid records from `validateRecord()`
 * @param rowIndices - Parallel array: `rowIndices[i]` is the original CSV row
 *                     index for `records[i]`, used for issue reporting.
 */
export function deduplicateRecords(
  records: HealthCheckRecord[],
  rowIndices: number[]
): DeduplicateResult {
  const seen = new Map<string, number>(); // key → first rowIndex
  const unique: HealthCheckRecord[] = [];
  const issues: RowIssue[] = [];
  let duplicateCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowIndex = rowIndices[i];
    const key = buildKey(record);

    if (seen.has(key)) {
      const firstRowIndex = seen.get(key)!;
      issues.push({
        rowIndex,
        field: "composite_key",
        message:
          `Duplicate of row ${firstRowIndex} ` +
          `(serviceId="${record.serviceId}", ` +
          `timestampUtc="${record.timestampUtc.toISOString()}", ` +
          `agent="${record.agent}", region="${record.region}")`,
        severity: "warning",
      });
      duplicateCount++;
    } else {
      seen.set(key, rowIndex);
      unique.push(record);
    }
  }

  return { records: unique, issues, duplicateCount };
}
