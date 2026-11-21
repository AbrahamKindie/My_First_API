/*
  Warnings:

  - You are about to drop the column `shopOrderId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `ShopOrder` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `shopId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_shopOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ShopOrder" DROP CONSTRAINT "ShopOrder_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ShopOrder" DROP CONSTRAINT "ShopOrder_shopId_fkey";

-- DropIndex
DROP INDEX "OrderItem_shopOrderId_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shopId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "shopOrderId";

-- DropTable
DROP TABLE "ShopOrder";

-- DropEnum
DROP TYPE "ShopOrderStatus";

-- CreateIndex
CREATE INDEX "Order_shopId_idx" ON "Order"("shopId");

-- CreateIndex
CREATE INDEX "Order_shopId_status_idx" ON "Order"("shopId", "status");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
