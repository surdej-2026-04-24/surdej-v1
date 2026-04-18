-- CreateTable
CREATE TABLE "FeatureUserOverride" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ringOverride" INTEGER,
    "grantedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUserOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureUserOverride_userId_idx" ON "FeatureUserOverride"("userId");

-- CreateIndex
CREATE INDEX "FeatureUserOverride_featureId_idx" ON "FeatureUserOverride"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUserOverride_featureId_userId_key" ON "FeatureUserOverride"("featureId", "userId");

-- AddForeignKey
ALTER TABLE "FeatureUserOverride" ADD CONSTRAINT "FeatureUserOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureFlag"("featureId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureUserOverride" ADD CONSTRAINT "FeatureUserOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
