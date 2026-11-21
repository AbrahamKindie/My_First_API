/*
  Warnings:

  - Made the column `shippingAddress` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shippingCity` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shippingCountry` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shippingName` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shippingPhone` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shippingAddress" SET NOT NULL,
ALTER COLUMN "shippingAddress" SET DEFAULT '',
ALTER COLUMN "shippingCity" SET NOT NULL,
ALTER COLUMN "shippingCity" SET DEFAULT '',
ALTER COLUMN "shippingCountry" SET NOT NULL,
ALTER COLUMN "shippingCountry" SET DEFAULT 'Ethiopia',
ALTER COLUMN "shippingName" SET NOT NULL,
ALTER COLUMN "shippingName" SET DEFAULT '',
ALTER COLUMN "shippingPhone" SET NOT NULL,
ALTER COLUMN "shippingPhone" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "Product_isFeatured_idx" ON "Product"("isFeatured");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
