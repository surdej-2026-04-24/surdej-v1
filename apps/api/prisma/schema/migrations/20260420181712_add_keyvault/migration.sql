-- CreateTable
CREATE TABLE "SecretVault" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'api-key',
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "metadata" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointKeyMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "envVar" TEXT NOT NULL DEFAULT 'API_KEY',
    "secretId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndpointKeyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecretVault_tenantId_category_idx" ON "SecretVault"("tenantId", "category");

-- CreateIndex
CREATE INDEX "SecretVault_tenantId_provider_idx" ON "SecretVault"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SecretVault_tenantId_slug_key" ON "SecretVault"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "EndpointKeyMapping_tenantId_endpoint_idx" ON "EndpointKeyMapping"("tenantId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointKeyMapping_tenantId_endpoint_envVar_key" ON "EndpointKeyMapping"("tenantId", "endpoint", "envVar");

-- AddForeignKey
ALTER TABLE "SecretVault" ADD CONSTRAINT "SecretVault_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointKeyMapping" ADD CONSTRAINT "EndpointKeyMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointKeyMapping" ADD CONSTRAINT "EndpointKeyMapping_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "SecretVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
