/*
  Warnings:

  - You are about to drop the column `status` on the `ProductReview` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `ProductReview` table. All the data in the column will be lost.
  - Made the column `comment` on table `ProductReview` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "ProductReview_productId_status_idx";

-- AlterTable
ALTER TABLE "ProductReview" DROP COLUMN "status",
DROP COLUMN "title",
ALTER COLUMN "comment" SET NOT NULL;

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateIndex
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");
