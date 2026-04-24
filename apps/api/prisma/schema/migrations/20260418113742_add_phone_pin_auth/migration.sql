/*
  Warnings:

  - You are about to drop the `EjendomstorvetListing` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pinHash" TEXT;

-- DropTable
DROP TABLE "EjendomstorvetListing";

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
