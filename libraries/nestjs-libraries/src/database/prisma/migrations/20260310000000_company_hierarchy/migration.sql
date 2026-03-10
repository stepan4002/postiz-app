-- Migration: company_hierarchy
-- Phase 1, Plan 02 — Social Command Centre
-- Adds Company, Brand, BrandVoice, SocialAccount tables and companyId FK on Organization.
-- This migration is additive-only: no existing upstream tables or columns are modified.

-- CreateTable: Company
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "industry" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Brand
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BrandVoice
CREATE TABLE "BrandVoice" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tone" TEXT[],
    "targetAudience" TEXT,
    "preferredHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blacklistedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "samplePosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SocialAccount
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT,
    "displayName" TEXT,
    "integrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- AddColumn: companyId on Organization (nullable)
ALTER TABLE "Organization" ADD COLUMN "companyId" TEXT;

-- CreateUniqueIndex: Company.slug
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateUniqueIndex: Brand.[companyId, slug]
CREATE UNIQUE INDEX "Brand_companyId_slug_key" ON "Brand"("companyId", "slug");

-- CreateUniqueIndex: BrandVoice.brandId
CREATE UNIQUE INDEX "BrandVoice_brandId_key" ON "BrandVoice"("brandId");

-- CreateUniqueIndex: SocialAccount.[brandId, platform]
CREATE UNIQUE INDEX "SocialAccount_brandId_platform_key" ON "SocialAccount"("brandId", "platform");

-- CreateIndex: Organization.companyId
CREATE INDEX "Organization_companyId_idx" ON "Organization"("companyId");

-- AddForeignKey: Brand -> Company
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BrandVoice -> Brand
ALTER TABLE "BrandVoice" ADD CONSTRAINT "BrandVoice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SocialAccount -> Brand
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Organization -> Company (nullable, no cascade — org may exist without a company)
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
