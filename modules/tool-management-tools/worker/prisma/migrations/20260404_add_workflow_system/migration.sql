-- AlterTable: UseCase — add workflow columns
ALTER TABLE "tool_management_tools"."UseCase"
    ADD COLUMN IF NOT EXISTS "workflowMode" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: WorkflowTask
CREATE TABLE IF NOT EXISTS "tool_management_tools"."WorkflowTask" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "systemPrompt" TEXT NOT NULL,
    "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dataSchema" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowSession
CREATE TABLE IF NOT EXISTS "tool_management_tools"."WorkflowSession" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "currentStepIdx" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "formData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SessionContextVersion
CREATE TABLE IF NOT EXISTS "tool_management_tools"."SessionContextVersion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "formData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionContextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SessionMessage
CREATE TABLE IF NOT EXISTS "tool_management_tools"."SessionMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: WorkflowTask
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTask_useCaseId_taskId_key" ON "tool_management_tools"."WorkflowTask"("useCaseId", "taskId");
CREATE INDEX IF NOT EXISTS "WorkflowTask_useCaseId_idx" ON "tool_management_tools"."WorkflowTask"("useCaseId");

-- CreateIndex: WorkflowSession
CREATE INDEX IF NOT EXISTS "WorkflowSession_useCaseId_idx" ON "tool_management_tools"."WorkflowSession"("useCaseId");
CREATE INDEX IF NOT EXISTS "WorkflowSession_userId_idx" ON "tool_management_tools"."WorkflowSession"("userId");
CREATE INDEX IF NOT EXISTS "WorkflowSession_status_idx" ON "tool_management_tools"."WorkflowSession"("status");

-- CreateIndex: SessionContextVersion
CREATE UNIQUE INDEX IF NOT EXISTS "SessionContextVersion_sessionId_stepIndex_key" ON "tool_management_tools"."SessionContextVersion"("sessionId", "stepIndex");
CREATE INDEX IF NOT EXISTS "SessionContextVersion_sessionId_idx" ON "tool_management_tools"."SessionContextVersion"("sessionId");

-- CreateIndex: SessionMessage
CREATE INDEX IF NOT EXISTS "SessionMessage_sessionId_stepIndex_idx" ON "tool_management_tools"."SessionMessage"("sessionId", "stepIndex");

-- AddForeignKey: WorkflowTask -> UseCase
DO $$ BEGIN
    ALTER TABLE "tool_management_tools"."WorkflowTask" ADD CONSTRAINT "WorkflowTask_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "tool_management_tools"."UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: WorkflowSession -> UseCase
DO $$ BEGIN
    ALTER TABLE "tool_management_tools"."WorkflowSession" ADD CONSTRAINT "WorkflowSession_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "tool_management_tools"."UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: SessionContextVersion -> WorkflowSession
DO $$ BEGIN
    ALTER TABLE "tool_management_tools"."SessionContextVersion" ADD CONSTRAINT "SessionContextVersion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tool_management_tools"."WorkflowSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: SessionMessage -> WorkflowSession
DO $$ BEGIN
    ALTER TABLE "tool_management_tools"."SessionMessage" ADD CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tool_management_tools"."WorkflowSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
