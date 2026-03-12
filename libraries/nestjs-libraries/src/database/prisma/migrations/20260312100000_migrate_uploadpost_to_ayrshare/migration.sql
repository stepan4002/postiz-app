-- ============================================================================
-- SOCIAL COMMAND CENTRE — Phase 13: Migrate Upload-Post → AyrShare
--
-- This migration copies data from Upload-Post tables into AyrShare tables
-- and updates Integration records to point to the new provider.
--
-- Steps:
--   1. Copy UploadPostConfig → AyrShareConfig (only where no AyrShareConfig exists)
--   2. Copy UploadPostProfile → AyrShareProfile (only where no AyrShareProfile exists)
--   3. Update Integration.providerIdentifier from 'upload-post' → 'ayrshare'
--   4. Copy UploadPostLog → AyrShareLog (only recent logs, last 30 days)
--
-- This migration is ADDITIVE — it does NOT drop Upload-Post tables.
-- Upload-Post tables will be dropped in a follow-up migration after verification.
-- ============================================================================

-- Step 1: Migrate UploadPostConfig → AyrShareConfig
-- Only insert where an AyrShareConfig doesn't already exist for the org
INSERT INTO "AyrShareConfig" (
    "id",
    "organizationId",
    "apiKey",
    "apiKeyEncrypted",
    "planType",
    "maxProfiles",
    "enabled",
    "lastVerifiedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    upc."organizationId",
    upc."apiKey",
    upc."apiKeyEncrypted",
    -- Map Upload-Post plan types to AyrShare equivalents
    CASE upc."planType"
        WHEN 'professional' THEN 'launch'
        WHEN 'business' THEN 'business'
        WHEN 'enterprise' THEN 'enterprise'
        ELSE 'launch'
    END,
    CASE upc."planType"
        WHEN 'professional' THEN 10
        WHEN 'business' THEN 50
        WHEN 'enterprise' THEN 150
        ELSE 10
    END,
    upc."enabled",
    upc."lastVerifiedAt",
    upc."createdAt",
    NOW()
FROM "UploadPostConfig" upc
WHERE NOT EXISTS (
    SELECT 1 FROM "AyrShareConfig" asc2
    WHERE asc2."organizationId" = upc."organizationId"
);

-- Step 2: Migrate UploadPostProfile → AyrShareProfile
-- profileUsername maps to profileKey, title is derived from company name + language
INSERT INTO "AyrShareProfile" (
    "id",
    "companyId",
    "organizationId",
    "profileKey",
    "title",
    "languageCode",
    "languageName",
    "brandId",
    "platforms",
    "integrationId",
    "enabled",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    upp."companyId",
    upp."organizationId",
    upp."profileUsername",
    -- Build a descriptive title from company name + language
    COALESCE(c."name", 'Unknown') || ' (' || upp."languageName" || ')',
    upp."languageCode",
    upp."languageName",
    upp."brandId",
    upp."platforms",
    upp."integrationId",
    upp."enabled",
    upp."createdAt",
    NOW()
FROM "UploadPostProfile" upp
LEFT JOIN "Company" c ON c."id" = upp."companyId"
WHERE NOT EXISTS (
    SELECT 1 FROM "AyrShareProfile" asp
    WHERE asp."companyId" = upp."companyId"
      AND asp."languageCode" = upp."languageCode"
)
-- Also skip if the integrationId is already claimed by an existing AyrShareProfile
AND (
    upp."integrationId" IS NULL
    OR NOT EXISTS (
        SELECT 1 FROM "AyrShareProfile" asp2
        WHERE asp2."integrationId" = upp."integrationId"
    )
);

-- Step 3: Update Integration records — change provider from 'upload-post' to 'ayrshare'
-- Only update integrations that are now linked to an AyrShareProfile
UPDATE "Integration"
SET "providerIdentifier" = 'ayrshare',
    "updatedAt" = NOW()
WHERE "providerIdentifier" = 'upload-post'
  AND "id" IN (
      SELECT "integrationId" FROM "AyrShareProfile"
      WHERE "integrationId" IS NOT NULL
  );

-- Step 4: Copy recent UploadPostLog entries → AyrShareLog (last 30 days)
-- This preserves recent audit trail for debugging
INSERT INTO "AyrShareLog" (
    "id",
    "profileId",
    "postVariantId",
    "endpoint",
    "method",
    "requestPayload",
    "responseCode",
    "responseBody",
    "ayrsharePostId",
    "status",
    "errorMessage",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    asp."id",  -- Map to AyrShareProfile via company+language match
    upl."postVariantId",
    upl."endpoint",
    'POST',  -- Upload-Post logs didn't track method; default to POST
    upl."requestPayload",
    upl."responseCode",
    upl."responseBody",
    upl."requestId",  -- Upload-Post's requestId maps to ayrsharePostId
    upl."status",
    upl."errorMessage",
    upl."createdAt",
    NOW()
FROM "UploadPostLog" upl
JOIN "UploadPostProfile" upp ON upp."id" = upl."profileId"
JOIN "AyrShareProfile" asp ON asp."companyId" = upp."companyId"
                           AND asp."languageCode" = upp."languageCode"
WHERE upl."createdAt" > NOW() - INTERVAL '30 days';
