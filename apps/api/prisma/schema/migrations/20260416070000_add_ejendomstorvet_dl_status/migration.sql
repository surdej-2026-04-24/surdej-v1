-- AlterTable
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlStatus" TEXT;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlBlobId" TEXT;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlReportBlobId" TEXT;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlSellerType" TEXT;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlError" TEXT;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EjendomstorvetListing" ADD COLUMN "dlLastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EjendomstorvetListing_dlStatus_idx" ON "EjendomstorvetListing"("dlStatus");
