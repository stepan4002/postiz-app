-- Phase 5: Content Generation Pipeline
-- Apply with: pnpm run prisma:migrate

-- AlterTable: AIConfig — add requireAllReview and confidenceThreshold fields
ALTER TABLE "AIConfig" ADD COLUMN "requireAllReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AIConfig" ADD COLUMN "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

-- CreateTable: ContentPost (one per AI generation request, has multiple platform variants)
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "mediaId" TEXT,
    "brief" TEXT,
    "contentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PostVariant (one per platform per ContentPost)
CREATE TABLE "PostVariant" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaVariantId" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewAction" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "originalCaption" TEXT,

    CONSTRAINT "PostVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ContentPost on (companyId, status) for dashboard filtering
CREATE INDEX "ContentPost_companyId_status_idx" ON "ContentPost"("companyId", "status");

-- CreateIndex: ContentPost on (companyId, createdAt) for timeline queries
CREATE INDEX "ContentPost_companyId_createdAt_idx" ON "ContentPost"("companyId", "createdAt");

-- CreateIndex: ContentPost on brandId for brand-scoped queries
CREATE INDEX "ContentPost_brandId_idx" ON "ContentPost"("brandId");

-- CreateIndex: PostVariant on postId for loading all variants of a post
CREATE INDEX "PostVariant_postId_idx" ON "PostVariant"("postId");

-- CreateIndex: PostVariant on (platform, status) for review queue filtering
CREATE INDEX "PostVariant_platform_status_idx" ON "PostVariant"("platform", "status");

-- CreateIndex: PostVariant on confidenceScore for auto-approval threshold queries
CREATE INDEX "PostVariant_confidenceScore_idx" ON "PostVariant"("confidenceScore");

-- AddForeignKey: ContentPost -> Company
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContentPost -> Brand
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PostVariant -> ContentPost
ALTER TABLE "PostVariant" ADD CONSTRAINT "PostVariant_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
