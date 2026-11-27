/*
  Warnings:

  - You are about to drop the column `orderId` on the `SupportTicket` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `SupportTicket` table. All the data in the column will be lost.
  - You are about to drop the column `shopId` on the `SupportTicket` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_orderId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_productId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_shopId_fkey";

-- DropIndex
DROP INDEX "SupportTicket_orderId_idx";

-- DropIndex
DROP INDEX "SupportTicket_productId_idx";

-- DropIndex
DROP INDEX "SupportTicket_shopId_idx";

-- AlterTable
ALTER TABLE "SupportTicket" DROP COLUMN "orderId",
DROP COLUMN "productId",
DROP COLUMN "shopId",
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "shopName" TEXT;

-- CreateIndex
CREATE INDEX "SupportTicket_shopName_idx" ON "SupportTicket"("shopName");

-- CreateIndex
CREATE INDEX "SupportTicket_productName_idx" ON "SupportTicket"("productName");
