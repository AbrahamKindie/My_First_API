-- CreateEnum
CREATE TYPE "ShopProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AdminPermission" ADD VALUE 'REVIEW_SHOP_PROFILE_CHANGES';

-- CreateTable
CREATE TABLE "ShopProfileChangeRequest" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "previousData" JSONB NOT NULL,
    "proposedData" JSONB NOT NULL,
    "status" "ShopProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopProfileChangeRequest_shopId_status_idx" ON "ShopProfileChangeRequest"("shopId", "status");

-- CreateIndex
CREATE INDEX "ShopProfileChangeRequest_status_createdAt_idx" ON "ShopProfileChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopProfileChangeRequest_reviewedById_idx" ON "ShopProfileChangeRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "ShopProfileChangeRequest" ADD CONSTRAINT "ShopProfileChangeRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProfileChangeRequest" ADD CONSTRAINT "ShopProfileChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
