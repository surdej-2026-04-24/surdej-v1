-- AddForeignKey
ALTER TABLE "Blob" ADD CONSTRAINT "Blob_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
