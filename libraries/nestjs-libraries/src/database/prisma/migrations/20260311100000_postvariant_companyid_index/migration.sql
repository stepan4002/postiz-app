-- Migration: Add denormalized companyId to PostVariant for NF3.4 compound index
-- Phase 7 Plan 05: gap closure for compound index requirement

-- Add denormalized companyId column (nullable — backfill populates existing rows)
ALTER TABLE "PostVariant" ADD COLUMN "companyId" TEXT;

-- Backfill companyId from ContentPost for all existing PostVariant rows
UPDATE "PostVariant" pv
SET "companyId" = cp."companyId"
FROM "ContentPost" cp
WHERE pv."postId" = cp."id";

-- Add FK constraint to Company
ALTER TABLE "PostVariant" ADD CONSTRAINT "PostVariant_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NF3.4: compound index on companyId + platform + status for dashboard queries
CREATE INDEX "PostVariant_companyId_platform_status_idx" ON "PostVariant"("companyId", "platform", "status");
