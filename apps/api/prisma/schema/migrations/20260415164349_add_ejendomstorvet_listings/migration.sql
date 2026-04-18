-- CreateTable
CREATE TABLE "EjendomstorvetListing" (
    "id" TEXT NOT NULL,
    "detailUrl" TEXT NOT NULL,
    "sellerUrl" TEXT,
    "address" TEXT,
    "title" TEXT,
    "flashline" TEXT,
    "municipality" TEXT,
    "municipalityCode" TEXT,
    "province" TEXT,
    "subcategory" TEXT,
    "listingType" TEXT,
    "type" TEXT,
    "streetName" TEXT,
    "zipCode" TEXT,
    "zipCodeName" TEXT,
    "floorAreaM2" INTEGER,
    "groundAreaM2" INTEGER,
    "yearlyRentDkk" INTEGER,
    "yearlyRentFloorAreaM2" INTEGER,
    "yearlyOperatingCostDkk" INTEGER,
    "priceInfo" INTEGER,
    "salesPriceDkk" INTEGER,
    "compensationDkk" INTEGER,
    "returnPercent" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "accountLogoUrl" TEXT,
    "energyLabels" TEXT[],
    "usageProposals" TEXT[],
    "caseIdentifier" TEXT,
    "gisX" DOUBLE PRECISION,
    "gisY" DOUBLE PRECISION,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "raw" JSONB,

    CONSTRAINT "EjendomstorvetListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_municipality_idx" ON "EjendomstorvetListing"("municipality");

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_subcategory_idx" ON "EjendomstorvetListing"("subcategory");

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_firstSeenAt_idx" ON "EjendomstorvetListing"("firstSeenAt");

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_lastSeenAt_idx" ON "EjendomstorvetListing"("lastSeenAt");

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_removedAt_idx" ON "EjendomstorvetListing"("removedAt");
