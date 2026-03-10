-- Migration: 20260310200000_scheduling_publishing
-- Phase 6: Scheduling & Publishing Engine
-- Extends PostVariant and ContentPost models; creates PublishAttempt audit log table.

-- ============================================================================
-- Extend ContentPost with scheduling fields
-- ============================================================================

ALTER TABLE "ContentPost"
  ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- ============================================================================
-- Extend PostVariant with scheduling and publishing tracking fields
-- ============================================================================

ALTER TABLE "PostVariant"
  ADD COLUMN "scheduledAt"            TIMESTAMP(3),
  ADD COLUMN "platformPostId"         TEXT,
  ADD COLUMN "platformUrl"            TEXT,
  ADD COLUMN "publishAttempts"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consecutiveFailures"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastPublishError"       TEXT,
  ADD COLUMN "publishedAt"            TIMESTAMP(3),
  ADD COLUMN "publishWindowExpiresAt" TIMESTAMP(3);

-- Index for scheduler_tick query: find variants due for publishing
CREATE INDEX "PostVariant_status_scheduledAt_idx" ON "PostVariant"("status", "scheduledAt");

-- Index for idempotency checks: find by platformPostId to avoid double-publishing
CREATE INDEX "PostVariant_platformPostId_idx" ON "PostVariant"("platformPostId");

-- ============================================================================
-- Create PublishAttempt audit log table (R10.6 — every attempt must be logged)
-- ============================================================================

CREATE TABLE "PublishAttempt" (
  "id"            TEXT NOT NULL,
  "variantId"     TEXT NOT NULL,
  "postId"        TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "success"       BOOLEAN NOT NULL,
  "responseCode"  INTEGER,
  "responseBody"  TEXT,
  "error"         TEXT,
  "errorType"     TEXT,

  CONSTRAINT "PublishAttempt_pkey" PRIMARY KEY ("id")
);

-- Foreign key: PublishAttempt -> PostVariant (cascade on variant delete)
ALTER TABLE "PublishAttempt"
  ADD CONSTRAINT "PublishAttempt_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "PostVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: PublishAttempt -> ContentPost (cascade on post delete)
ALTER TABLE "PublishAttempt"
  ADD CONSTRAINT "PublishAttempt_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for PublishAttempt
CREATE INDEX "PublishAttempt_variantId_idx" ON "PublishAttempt"("variantId");
CREATE INDEX "PublishAttempt_postId_idx"    ON "PublishAttempt"("postId");
CREATE INDEX "PublishAttempt_timestamp_idx" ON "PublishAttempt"("timestamp");
