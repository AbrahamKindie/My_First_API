/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `shopCategoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Shop` table. All the data in the column will be lost.
  - You are about to drop the column `shopId` on the `ShopCategory` table. All the data in the column will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `ShopCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productCategoryId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `shopId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `shopCategoryId` to the `Shop` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_shopCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "ShopCategory" DROP CONSTRAINT "ShopCategory_shopId_fkey";

-- DropIndex
DROP INDEX "Product_categoryId_idx";

-- DropIndex
DROP INDEX "Product_shopCategoryId_idx";

-- DropIndex
DROP INDEX "Shop_category_idx";

-- DropIndex
DROP INDEX "ShopCategory_shopId_idx";

-- DropIndex
DROP INDEX "ShopCategory_shopId_name_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "categoryId",
DROP COLUMN "shopCategoryId",
ADD COLUMN     "productCategoryId" INTEGER NOT NULL,
ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Shop" DROP COLUMN "category",
ADD COLUMN     "shopCategoryId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ShopCategory" DROP COLUMN "shopId";

-- DropTable
DROP TABLE "Category";

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCategory_shopId_idx" ON "ProductCategory"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_shopId_name_key" ON "ProductCategory"("shopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_id_shopId_key" ON "ProductCategory"("id", "shopId");

-- CreateIndex
CREATE INDEX "Product_productCategoryId_shopId_idx" ON "Product"("productCategoryId", "shopId");

-- CreateIndex
CREATE INDEX "Shop_shopCategoryId_idx" ON "Shop"("shopCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCategory_name_key" ON "ShopCategory"("name");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productCategoryId_shopId_fkey" FOREIGN KEY ("productCategoryId", "shopId") REFERENCES "ProductCategory"("id", "shopId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_shopCategoryId_fkey" FOREIGN KEY ("shopCategoryId") REFERENCES "ShopCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
