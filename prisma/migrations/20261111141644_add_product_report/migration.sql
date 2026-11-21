-- CreateEnum
CREATE TYPE "ProductReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ProductReportReason" AS ENUM ('COUNTERFEIT', 'MISLEADING_INFORMATION', 'PROHIBITED_PRODUCT', 'SUSPICIOUS_ACTIVITY', 'OTHER');

-- CreateTable
CREATE TABLE "ProductLike" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReport" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" "ProductReportReason" NOT NULL,
    "description" TEXT,
    "status" "ProductReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductLike_userId_idx" ON "ProductLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLike_productId_userId_key" ON "ProductLike"("productId", "userId");

-- CreateIndex
CREATE INDEX "ProductReport_productId_status_idx" ON "ProductReport"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductReport_userId_createdAt_idx" ON "ProductReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReport_status_createdAt_idx" ON "ProductReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReport_reviewedById_idx" ON "ProductReport"("reviewedById");

-- AddForeignKey
ALTER TABLE "ProductLike" ADD CONSTRAINT "ProductLike_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLike" ADD CONSTRAINT "ProductLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReport" ADD CONSTRAINT "ProductReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
