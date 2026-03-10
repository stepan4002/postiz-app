-- Phase 4: Media Library Processing
-- Adds companyId, dimensions, format, and tags to Media;
-- creates MediaVariant and MediaProcessingJob tables.

-- Add new columns to existing Media table
ALTER TABLE "Media" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Media" ADD COLUMN "width" INTEGER;
ALTER TABLE "Media" ADD COLUMN "height" INTEGER;
ALTER TABLE "Media" ADD COLUMN "format" TEXT;
ALTER TABLE "Media" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- FK: Media -> Company
ALTER TABLE "Media" ADD CONSTRAINT "Media_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes on Media
CREATE INDEX IF NOT EXISTS "Media_companyId_idx" ON "Media"("companyId");
CREATE INDEX IF NOT EXISTS "Media_companyId_createdAt_idx" ON "Media"("companyId", "createdAt");

-- MediaVariant table
CREATE TABLE "MediaVariant" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "mediaId"   TEXT NOT NULL,
  "platform"  TEXT NOT NULL,
  "width"     INTEGER NOT NULL,
  "height"    INTEGER NOT NULL,
  "path"      TEXT NOT NULL,
  "fileSize"  INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MediaVariant_mediaId_platform_width_height_key"
  ON "MediaVariant"("mediaId", "platform", "width", "height");

CREATE INDEX "MediaVariant_mediaId_idx" ON "MediaVariant"("mediaId");

-- MediaProcessingJob table
CREATE TABLE "MediaProcessingJob" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "mediaId"   TEXT NOT NULL,
  "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"    TEXT NOT NULL DEFAULT 'pending',
  "error"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MediaProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaProcessingJob_status_createdAt_idx" ON "MediaProcessingJob"("status", "createdAt");
