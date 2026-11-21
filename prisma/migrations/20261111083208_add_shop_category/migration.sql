-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shopCategoryId" INTEGER;

-- CreateTable
CREATE TABLE "ShopCategory" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopCategory_shopId_idx" ON "ShopCategory"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCategory_shopId_name_key" ON "ShopCategory"("shopId", "name");

-- CreateIndex
CREATE INDEX "Product_shopCategoryId_idx" ON "Product"("shopCategoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopCategoryId_fkey" FOREIGN KEY ("shopCategoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCategory" ADD CONSTRAINT "ShopCategory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
