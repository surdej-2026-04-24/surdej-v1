-- CreateTable: MixinKeyValue (per-user mixin data storage)
CREATE TABLE "MixinKeyValue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mixinId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixinKeyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IframeTool (registered iframe tools)
CREATE TABLE "IframeTool" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'AppWindow',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IframeTool_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "MixinKeyValue_tenantId_userId_mixinId_key_key" ON "MixinKeyValue"("tenantId", "userId", "mixinId", "key");
CREATE UNIQUE INDEX "IframeTool_tenantId_slug_key" ON "IframeTool"("tenantId", "slug");

-- Indexes
CREATE INDEX "MixinKeyValue_tenantId_userId_mixinId_idx" ON "MixinKeyValue"("tenantId", "userId", "mixinId");
CREATE INDEX "IframeTool_tenantId_idx" ON "IframeTool"("tenantId");

-- Foreign keys
ALTER TABLE "MixinKeyValue" ADD CONSTRAINT "MixinKeyValue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MixinKeyValue" ADD CONSTRAINT "MixinKeyValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IframeTool" ADD CONSTRAINT "IframeTool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
