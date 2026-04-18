-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tool_management_tools";

-- CreateTable (Tool already exists from Phase 1 seed, but ensure it's there)
CREATE TABLE IF NOT EXISTS "tool_management_tools"."Tool" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "icon" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "useCases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promptTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCase
CREATE TABLE "tool_management_tools"."UseCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCaseVersion
CREATE TABLE "tool_management_tools"."UseCaseVersion" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelTier" TEXT NOT NULL DEFAULT 'medium',
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCaseTestCase
CREATE TABLE "tool_management_tools"."UseCaseTestCase" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "evaluationPrompt" TEXT NOT NULL,
    "expectedBehavior" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseCaseTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCaseTestAttachment
CREATE TABLE "tool_management_tools"."UseCaseTestAttachment" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseTestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCaseTestRun
CREATE TABLE "tool_management_tools"."UseCaseTestRun" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "modelTier" TEXT NOT NULL,
    "aiResponse" TEXT,
    "evaluationResult" JSONB,
    "durationMs" INTEGER,
    "tokenUsage" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tool_name_key" ON "tool_management_tools"."Tool"("name");
CREATE INDEX IF NOT EXISTS "Tool_tenantId_idx" ON "tool_management_tools"."Tool"("tenantId");
CREATE INDEX IF NOT EXISTS "Tool_category_idx" ON "tool_management_tools"."Tool"("category");
CREATE INDEX IF NOT EXISTS "Tool_isEnabled_idx" ON "tool_management_tools"."Tool"("isEnabled");

CREATE UNIQUE INDEX "UseCase_slug_key" ON "tool_management_tools"."UseCase"("slug");
CREATE INDEX "UseCase_tenantId_idx" ON "tool_management_tools"."UseCase"("tenantId");
CREATE INDEX "UseCase_slug_idx" ON "tool_management_tools"."UseCase"("slug");

CREATE UNIQUE INDEX "UseCaseVersion_useCaseId_version_key" ON "tool_management_tools"."UseCaseVersion"("useCaseId", "version");
CREATE INDEX "UseCaseVersion_useCaseId_idx" ON "tool_management_tools"."UseCaseVersion"("useCaseId");

CREATE INDEX "UseCaseTestCase_useCaseId_idx" ON "tool_management_tools"."UseCaseTestCase"("useCaseId");

CREATE INDEX "UseCaseTestAttachment_testCaseId_idx" ON "tool_management_tools"."UseCaseTestAttachment"("testCaseId");

CREATE INDEX "UseCaseTestRun_testCaseId_idx" ON "tool_management_tools"."UseCaseTestRun"("testCaseId");
CREATE INDEX "UseCaseTestRun_versionId_idx" ON "tool_management_tools"."UseCaseTestRun"("versionId");
CREATE INDEX "UseCaseTestRun_status_idx" ON "tool_management_tools"."UseCaseTestRun"("status");

-- AddForeignKey
ALTER TABLE "tool_management_tools"."UseCaseVersion" ADD CONSTRAINT "UseCaseVersion_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "tool_management_tools"."UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_management_tools"."UseCaseTestCase" ADD CONSTRAINT "UseCaseTestCase_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "tool_management_tools"."UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_management_tools"."UseCaseTestAttachment" ADD CONSTRAINT "UseCaseTestAttachment_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "tool_management_tools"."UseCaseTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_management_tools"."UseCaseTestRun" ADD CONSTRAINT "UseCaseTestRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "tool_management_tools"."UseCaseTestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_management_tools"."UseCaseTestRun" ADD CONSTRAINT "UseCaseTestRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "tool_management_tools"."UseCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
