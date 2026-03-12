-- ============================================================================
-- SOCIAL COMMAND CENTRE — Phase 13: AyrShare API Gateway
-- Migration: Create AyrShare tables + add relations to existing models
--
-- New tables:
--   AyrShareConfig              — API key config (one per Organization)
--   AyrShareProfile             — Sub-account profiles (company + brand + language)
--   AyrShareLog                 — API call audit trail
--   AyrShareWebhookSubscription — Registered webhooks per profile
--   AyrShareMessage             — DM tracking (Facebook, Instagram, X)
--
-- Modified tables:
--   Organization, Company, Brand, Integration — inverse relation columns added
-- ============================================================================

-- AyrShareConfig: one per Organization
CREATE TABLE "AyrShareConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiKeyEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "planType" TEXT NOT NULL DEFAULT 'launch',
    "maxProfiles" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyrShareConfig_pkey" PRIMARY KEY ("id")
);

-- AyrShareProfile: maps Company+Brand+Language → AyrShare sub-account
CREATE TABLE "AyrShareProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "languageName" TEXT NOT NULL,
    "brandId" TEXT,
    "platforms" TEXT[],
    "integrationId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyrShareProfile_pkey" PRIMARY KEY ("id")
);

-- AyrShareLog: API call audit trail
CREATE TABLE "AyrShareLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "postVariantId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "requestPayload" JSONB NOT NULL,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "ayrsharePostId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyrShareLog_pkey" PRIMARY KEY ("id")
);

-- AyrShareWebhookSubscription: registered webhooks per profile
CREATE TABLE "AyrShareWebhookSubscription" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "ayrshareWebhookId" TEXT,
    "callbackUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyrShareWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- AyrShareMessage: DM tracking (Facebook, Instagram, X)
CREATE TABLE "AyrShareMessage" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "externalId" TEXT,
    "senderId" TEXT,
    "senderName" TEXT,
    "recipientId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyrShareMessage_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "AyrShareConfig_organizationId_key" ON "AyrShareConfig"("organizationId");
CREATE UNIQUE INDEX "AyrShareProfile_profileKey_key" ON "AyrShareProfile"("profileKey");
CREATE UNIQUE INDEX "AyrShareProfile_integrationId_key" ON "AyrShareProfile"("integrationId");
CREATE UNIQUE INDEX "AyrShareProfile_companyId_languageCode_key" ON "AyrShareProfile"("companyId", "languageCode");
CREATE UNIQUE INDEX "AyrShareWebhookSubscription_profileId_webhookType_key" ON "AyrShareWebhookSubscription"("profileId", "webhookType");

-- Performance indexes
CREATE INDEX "AyrShareProfile_organizationId_idx" ON "AyrShareProfile"("organizationId");
CREATE INDEX "AyrShareProfile_companyId_idx" ON "AyrShareProfile"("companyId");
CREATE INDEX "AyrShareLog_profileId_idx" ON "AyrShareLog"("profileId");
CREATE INDEX "AyrShareLog_ayrsharePostId_idx" ON "AyrShareLog"("ayrsharePostId");
CREATE INDEX "AyrShareLog_status_idx" ON "AyrShareLog"("status");
CREATE INDEX "AyrShareWebhookSubscription_active_idx" ON "AyrShareWebhookSubscription"("active");
CREATE INDEX "AyrShareMessage_profileId_idx" ON "AyrShareMessage"("profileId");
CREATE INDEX "AyrShareMessage_organizationId_idx" ON "AyrShareMessage"("organizationId");
CREATE INDEX "AyrShareMessage_platform_idx" ON "AyrShareMessage"("platform");
CREATE INDEX "AyrShareMessage_direction_idx" ON "AyrShareMessage"("direction");
CREATE INDEX "AyrShareMessage_createdAt_idx" ON "AyrShareMessage"("createdAt");

-- Foreign keys
ALTER TABLE "AyrShareConfig" ADD CONSTRAINT "AyrShareConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AyrShareProfile" ADD CONSTRAINT "AyrShareProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AyrShareProfile" ADD CONSTRAINT "AyrShareProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AyrShareProfile" ADD CONSTRAINT "AyrShareProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AyrShareProfile" ADD CONSTRAINT "AyrShareProfile_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AyrShareLog" ADD CONSTRAINT "AyrShareLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AyrShareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AyrShareWebhookSubscription" ADD CONSTRAINT "AyrShareWebhookSubscription_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AyrShareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AyrShareMessage" ADD CONSTRAINT "AyrShareMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AyrShareProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
