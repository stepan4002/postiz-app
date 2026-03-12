-- ============================================================================
-- SOCIAL COMMAND CENTRE — Phase 13: Drop Upload-Post Tables
--
-- WARNING: Run this migration ONLY after verifying that AyrShare migration
-- (20260312100000_migrate_uploadpost_to_ayrshare) completed successfully
-- and all data has been verified in the AyrShare tables.
--
-- This migration is DESTRUCTIVE — it drops all Upload-Post tables and
-- removes the relation column from the Integration model.
-- ============================================================================

-- Drop foreign key constraints first
ALTER TABLE "UploadPostLog" DROP CONSTRAINT IF EXISTS "UploadPostLog_profileId_fkey";
ALTER TABLE "UploadPostProfile" DROP CONSTRAINT IF EXISTS "UploadPostProfile_companyId_fkey";
ALTER TABLE "UploadPostProfile" DROP CONSTRAINT IF EXISTS "UploadPostProfile_organizationId_fkey";
ALTER TABLE "UploadPostProfile" DROP CONSTRAINT IF EXISTS "UploadPostProfile_brandId_fkey";
ALTER TABLE "UploadPostProfile" DROP CONSTRAINT IF EXISTS "UploadPostProfile_integrationId_fkey";
ALTER TABLE "UploadPostConfig" DROP CONSTRAINT IF EXISTS "UploadPostConfig_organizationId_fkey";

-- Drop tables in dependency order
DROP TABLE IF EXISTS "UploadPostLog";
DROP TABLE IF EXISTS "UploadPostProfile";
DROP TABLE IF EXISTS "UploadPostConfig";
