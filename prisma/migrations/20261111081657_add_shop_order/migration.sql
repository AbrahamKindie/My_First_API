-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shopOrderId" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shopId" INTEGER;

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopOrder_shopId_status_idx" ON "ShopOrder"("shopId", "status");

-- CreateIndex
CREATE INDEX "ShopOrder_orderId_idx" ON "ShopOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_orderId_shopId_key" ON "ShopOrder"("orderId", "shopId");

-- CreateIndex
CREATE INDEX "OrderItem_shopOrderId_idx" ON "OrderItem"("shopOrderId");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
