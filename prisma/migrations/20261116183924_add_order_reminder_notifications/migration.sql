/*
  Warnings:

  - A unique constraint covering the columns `[userId,orderId,type]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrderEmailJobType" AS ENUM ('PENDING_REMINDER', 'AUTO_CANCELLATION');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ORDER_PENDING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_AUTO_CANCELLED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "orderId" INTEGER;

-- CreateTable
CREATE TABLE "OrderEmailJob" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "recipientUserId" INTEGER NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "type" "OrderEmailJobType" NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderEmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEmailJob_status_nextAttemptAt_idx" ON "OrderEmailJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OrderEmailJob_orderId_idx" ON "OrderEmailJob"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEmailJob_orderId_recipientUserId_type_key" ON "OrderEmailJob"("orderId", "recipientUserId", "type");

-- CreateIndex
CREATE INDEX "Notification_orderId_idx" ON "Notification"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_orderId_type_key" ON "Notification"("userId", "orderId", "type");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEmailJob" ADD CONSTRAINT "OrderEmailJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
