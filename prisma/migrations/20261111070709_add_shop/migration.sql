-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SHOP_OWNER';

-- CreateTable
CREATE TABLE "Shop" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "ShopStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_ownerId_key" ON "Shop"("ownerId");

-- CreateIndex
CREATE INDEX "Shop_status_idx" ON "Shop"("status");

-- CreateIndex
CREATE INDEX "Shop_category_idx" ON "Shop"("category");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
