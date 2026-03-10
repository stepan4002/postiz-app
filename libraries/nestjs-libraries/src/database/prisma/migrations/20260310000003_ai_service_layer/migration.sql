-- Phase 3: AI Service Layer
-- Apply with: pnpm run prisma:migrate

-- CreateTable: AIConfig (one per company, stores provider preference and budget)
CREATE TABLE "AIConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'openai',
    "preferredModels" JSONB NOT NULL DEFAULT '{}',
    "weeklyBudgetUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AICostLog (one row per AI call, for cost tracking and analytics)
CREATE TABLE "AICostLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "postId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AIConfig unique on companyId (one config per company)
CREATE UNIQUE INDEX "AIConfig_companyId_key" ON "AIConfig"("companyId");

-- CreateIndex: AIConfig on companyId for FK lookup
CREATE INDEX "AIConfig_companyId_idx" ON "AIConfig"("companyId");

-- CreateIndex: AICostLog on (companyId, createdAt) for time-range cost queries
CREATE INDEX "AICostLog_companyId_createdAt_idx" ON "AICostLog"("companyId", "createdAt");

-- CreateIndex: AICostLog on (companyId, taskType) for per-task-type cost breakdown
CREATE INDEX "AICostLog_companyId_taskType_idx" ON "AICostLog"("companyId", "taskType");

-- AddForeignKey: AIConfig -> Company
ALTER TABLE "AIConfig" ADD CONSTRAINT "AIConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AICostLog -> Company
ALTER TABLE "AICostLog" ADD CONSTRAINT "AICostLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
