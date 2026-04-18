/*
  Warnings:

  - You are about to drop the `FeedbackEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FeedbackEntry" DROP CONSTRAINT "FeedbackEntry_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "FeedbackEntry" DROP CONSTRAINT "FeedbackEntry_userId_fkey";

-- DropTable
DROP TABLE "FeedbackEntry";

-- CreateTable
CREATE TABLE "FeedbackSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FeedbackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackNavigation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackNavigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackScreenshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRecording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackChatTranscript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "conversationTitle" TEXT,
    "model" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackChatTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackSession_userId_idx" ON "FeedbackSession"("userId");

-- CreateIndex
CREATE INDEX "FeedbackSession_tenantId_idx" ON "FeedbackSession"("tenantId");

-- CreateIndex
CREATE INDEX "FeedbackNavigation_sessionId_idx" ON "FeedbackNavigation"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackScreenshot_sessionId_idx" ON "FeedbackScreenshot"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackRecording_sessionId_idx" ON "FeedbackRecording"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackChatTranscript_sessionId_idx" ON "FeedbackChatTranscript"("sessionId");

-- AddForeignKey
ALTER TABLE "FeedbackSession" ADD CONSTRAINT "FeedbackSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSession" ADD CONSTRAINT "FeedbackSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackNavigation" ADD CONSTRAINT "FeedbackNavigation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FeedbackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackScreenshot" ADD CONSTRAINT "FeedbackScreenshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FeedbackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecording" ADD CONSTRAINT "FeedbackRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FeedbackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackChatTranscript" ADD CONSTRAINT "FeedbackChatTranscript_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FeedbackSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
