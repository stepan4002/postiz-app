-- Phase 2: Token health tracking fields on Integration
ALTER TABLE "Integration" ADD COLUMN "lastRefreshedAt" TIMESTAMP(3);
ALTER TABLE "Integration" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Integration" ADD COLUMN "tokenEncrypted" BOOLEAN NOT NULL DEFAULT false;
