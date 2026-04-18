-- CreateTable: WorkflowTag
CREATE TABLE IF NOT EXISTS "tool_management_tools"."WorkflowTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UseCaseTag (join table)
CREATE TABLE IF NOT EXISTS "tool_management_tools"."UseCaseTag" (
    "useCaseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseTag_pkey" PRIMARY KEY ("useCaseId", "tagId")
);

-- CreateIndex: WorkflowTag unique name
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTag_name_key" ON "tool_management_tools"."WorkflowTag"("name");

-- CreateIndex: WorkflowTag name
CREATE INDEX IF NOT EXISTS "WorkflowTag_name_idx" ON "tool_management_tools"."WorkflowTag"("name");

-- CreateIndex: UseCaseTag useCaseId
CREATE INDEX IF NOT EXISTS "UseCaseTag_useCaseId_idx" ON "tool_management_tools"."UseCaseTag"("useCaseId");

-- CreateIndex: UseCaseTag tagId
CREATE INDEX IF NOT EXISTS "UseCaseTag_tagId_idx" ON "tool_management_tools"."UseCaseTag"("tagId");

-- AddForeignKey: UseCaseTag → UseCase
ALTER TABLE "tool_management_tools"."UseCaseTag"
    ADD CONSTRAINT "UseCaseTag_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "tool_management_tools"."UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: UseCaseTag → WorkflowTag
ALTER TABLE "tool_management_tools"."UseCaseTag"
    ADD CONSTRAINT "UseCaseTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tool_management_tools"."WorkflowTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
