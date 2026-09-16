-- CreateTable
CREATE TABLE "UploadRun" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL,
    "acceptedRows" INTEGER NOT NULL,
    "rejectedRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "UploadRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "uploadRunId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "timestampUtc" TIMESTAMP(3) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" DOUBLE PRECISION,
    "agent" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadRun_uploadedAt_idx" ON "UploadRun"("uploadedAt");

-- CreateIndex
CREATE INDEX "HealthCheck_timestampUtc_idx" ON "HealthCheck"("timestampUtc");

-- CreateIndex
CREATE INDEX "HealthCheck_serviceId_idx" ON "HealthCheck"("serviceId");

-- CreateIndex
CREATE INDEX "HealthCheck_serviceName_idx" ON "HealthCheck"("serviceName");

-- CreateIndex
CREATE INDEX "HealthCheck_statusCode_idx" ON "HealthCheck"("statusCode");

-- CreateIndex
CREATE INDEX "HealthCheck_uploadRunId_idx" ON "HealthCheck"("uploadRunId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthCheck_serviceId_timestampUtc_agent_region_key" ON "HealthCheck"("serviceId", "timestampUtc", "agent", "region");

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_uploadRunId_fkey" FOREIGN KEY ("uploadRunId") REFERENCES "UploadRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
