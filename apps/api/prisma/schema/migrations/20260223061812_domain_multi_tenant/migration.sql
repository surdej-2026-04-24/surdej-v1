/*
  Warnings:

  - A unique constraint covering the columns `[contentHash]` on the table `Blob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,domain]` on the table `TenantDomain` will be added. If there are existing duplicate values, this will fail.
  - Made the column `tenantId` on table `Blob` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Blob" DROP CONSTRAINT "Blob_tenantId_fkey";

-- DropIndex
DROP INDEX "TenantDomain_domain_key";

-- AlterTable
ALTER TABLE "Blob" ADD COLUMN     "contentHash" TEXT,
ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "embedding" vector(3072),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentChunk_blobId_idx" ON "DocumentChunk"("blobId");

-- CreateIndex
CREATE INDEX "DocumentChunk_tenantId_idx" ON "DocumentChunk"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Blob_contentHash_key" ON "Blob"("contentHash");

-- CreateIndex
CREATE INDEX "Blob_tenantId_idx" ON "Blob"("tenantId");

-- CreateIndex
CREATE INDEX "Session_tenantId_idx" ON "Session"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_tenantId_domain_key" ON "TenantDomain"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blob" ADD CONSTRAINT "Blob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "Blob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
