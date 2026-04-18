-- CreateEnum
CREATE TYPE "BridgeConsentLevel" AS ENUM ('READ', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "BridgeConsentStatus" AS ENUM ('ALLOWED', 'DENIED', 'REVOKED');

-- AlterTable
ALTER TABLE "Blob" ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "BlobActionLog" (
    "id" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "details" JSONB,
    "source" TEXT NOT NULL DEFAULT 'api',
    "userId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeConsentTenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "description" TEXT,
    "level" "BridgeConsentLevel" NOT NULL DEFAULT 'READ',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeConsentTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeConsentUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "level" "BridgeConsentLevel" NOT NULL DEFAULT 'READ',
    "status" "BridgeConsentStatus" NOT NULL DEFAULT 'ALLOWED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeConsentUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyValueStore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "tags" TEXT[],
    "source" TEXT,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValueStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlobActionLog_blobId_createdAt_idx" ON "BlobActionLog"("blobId", "createdAt");

-- CreateIndex
CREATE INDEX "BlobActionLog_tenantId_createdAt_idx" ON "BlobActionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BlobActionLog_action_createdAt_idx" ON "BlobActionLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "BridgeConsentTenant_tenantId_idx" ON "BridgeConsentTenant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeConsentTenant_tenantId_domain_key" ON "BridgeConsentTenant"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "BridgeConsentUser_userId_tenantId_idx" ON "BridgeConsentUser"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeConsentUser_userId_tenantId_domain_key" ON "BridgeConsentUser"("userId", "tenantId", "domain");

-- CreateIndex
CREATE INDEX "KeyValueStore_tenantId_tags_idx" ON "KeyValueStore"("tenantId", "tags");

-- CreateIndex
CREATE INDEX "KeyValueStore_tenantId_source_idx" ON "KeyValueStore"("tenantId", "source");

-- CreateIndex
CREATE INDEX "KeyValueStore_expiresAt_idx" ON "KeyValueStore"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeyValueStore_tenantId_key_key" ON "KeyValueStore"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "BlobActionLog" ADD CONSTRAINT "BlobActionLog_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "Blob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeConsentTenant" ADD CONSTRAINT "BridgeConsentTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeConsentUser" ADD CONSTRAINT "BridgeConsentUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeConsentUser" ADD CONSTRAINT "BridgeConsentUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyValueStore" ADD CONSTRAINT "KeyValueStore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyValueStore" ADD CONSTRAINT "KeyValueStore_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
