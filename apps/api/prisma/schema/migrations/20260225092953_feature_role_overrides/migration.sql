-- CreateTable
CREATE TABLE "FeatureRoleOverride" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ringOverride" INTEGER,
    "grantedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRoleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureRoleOverride_role_idx" ON "FeatureRoleOverride"("role");

-- CreateIndex
CREATE INDEX "FeatureRoleOverride_featureId_idx" ON "FeatureRoleOverride"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureRoleOverride_featureId_role_key" ON "FeatureRoleOverride"("featureId", "role");

-- AddForeignKey
ALTER TABLE "FeatureRoleOverride" ADD CONSTRAINT "FeatureRoleOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureFlag"("featureId") ON DELETE CASCADE ON UPDATE CASCADE;
