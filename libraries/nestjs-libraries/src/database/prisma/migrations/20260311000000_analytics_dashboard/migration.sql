-- SOCIAL COMMAND CENTRE -- Phase 7: Analytics & Dashboard
-- Migration: 20260311000000_analytics_dashboard
-- Creates PostMetrics and DashboardCache tables with indexes.
-- Apply with: pnpm run dev:docker && pnpm run prisma:migrate

-- CreateTable: PostMetrics
-- Stores per-post engagement metrics for each snapshot window (1h, 24h, 7d).
-- @@unique([variantId, snapshotType]) enables idempotent upsert (R11.3).
CREATE TABLE "PostMetrics" (
    "id"           TEXT NOT NULL,
    "variantId"    TEXT NOT NULL,
    "postId"       TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "platform"     TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "impressions"  INTEGER,
    "reach"        INTEGER,
    "likes"        INTEGER,
    "comments"     INTEGER,
    "shares"       INTEGER,
    "saves"        INTEGER,
    "clicks"       INTEGER,
    "fetchedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DashboardCache
-- Stores pre-computed dashboard summaries per company (one row per company).
CREATE TABLE "DashboardCache" (
    "id"                  TEXT NOT NULL,
    "companyId"           TEXT NOT NULL,
    "scheduledTodayCount" INTEGER NOT NULL DEFAULT 0,
    "pendingReviewCount"  INTEGER NOT NULL DEFAULT 0,
    "failedPostsCount"    INTEGER NOT NULL DEFAULT 0,
    "topPostsJson"        JSONB NOT NULL DEFAULT '[]',
    "scheduledPostsJson"  JSONB NOT NULL DEFAULT '[]',
    "failedPostsJson"     JSONB NOT NULL DEFAULT '[]',
    "pendingReviewJson"   JSONB NOT NULL DEFAULT '[]',
    "computedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardCache_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: PostMetrics(variantId, snapshotType)
-- R11.3 idempotent upsert key — one metrics row per variant per snapshot window.
CREATE UNIQUE INDEX "PostMetrics_variantId_snapshotType_key"
    ON "PostMetrics"("variantId", "snapshotType");

-- CreateUniqueIndex: DashboardCache(companyId)
-- One cache entry per company.
CREATE UNIQUE INDEX "DashboardCache_companyId_key"
    ON "DashboardCache"("companyId");

-- CreateIndex: PostMetrics(companyId, createdAt)  — NF3.4 time-range queries
CREATE INDEX "PostMetrics_companyId_createdAt_idx"
    ON "PostMetrics"("companyId", "createdAt");

-- CreateIndex: PostMetrics(companyId, platform)  — cross-platform filtering
CREATE INDEX "PostMetrics_companyId_platform_idx"
    ON "PostMetrics"("companyId", "platform");

-- CreateIndex: PostMetrics(postId)  — per-ContentPost aggregation
CREATE INDEX "PostMetrics_postId_idx"
    ON "PostMetrics"("postId");

-- CreateIndex: PostMetrics(companyId, fetchedAt)  — top performers last 7 days
CREATE INDEX "PostMetrics_companyId_fetchedAt_idx"
    ON "PostMetrics"("companyId", "fetchedAt");

-- CreateIndex: DashboardCache(companyId)
CREATE INDEX "DashboardCache_companyId_idx"
    ON "DashboardCache"("companyId");

-- CreateIndex: DashboardCache(computedAt)
CREATE INDEX "DashboardCache_computedAt_idx"
    ON "DashboardCache"("computedAt");

-- AddForeignKey: PostMetrics.variantId -> PostVariant.id (CASCADE)
ALTER TABLE "PostMetrics"
    ADD CONSTRAINT "PostMetrics_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "PostVariant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PostMetrics.postId -> ContentPost.id (CASCADE)
ALTER TABLE "PostMetrics"
    ADD CONSTRAINT "PostMetrics_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "ContentPost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PostMetrics.companyId -> Company.id (CASCADE)
ALTER TABLE "PostMetrics"
    ADD CONSTRAINT "PostMetrics_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: DashboardCache.companyId -> Company.id (CASCADE)
ALTER TABLE "DashboardCache"
    ADD CONSTRAINT "DashboardCache_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
