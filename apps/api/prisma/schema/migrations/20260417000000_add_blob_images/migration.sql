-- CreateTable
CREATE TABLE "BlobImage" (
    "id" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageNum" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlobImage_blobId_idx" ON "BlobImage"("blobId");

-- CreateIndex
CREATE INDEX "BlobImage_tenantId_idx" ON "BlobImage"("tenantId");

-- AddForeignKey
ALTER TABLE "BlobImage" ADD CONSTRAINT "BlobImage_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "Blob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlobImage" ADD CONSTRAINT "BlobImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
