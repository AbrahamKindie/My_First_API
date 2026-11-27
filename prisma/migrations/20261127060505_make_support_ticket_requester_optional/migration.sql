/*
  Warnings:

  - A unique constraint covering the columns `[guestAccessTokenHash]` on the table `SupportTicket` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "SupportMessage" DROP CONSTRAINT "SupportMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicket" DROP CONSTRAINT "SupportTicket_requesterId_fkey";

-- AlterTable
ALTER TABLE "SupportMessage" ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "guestAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "guestAccessTokenHash" TEXT,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "requesterId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_guestAccessTokenHash_key" ON "SupportTicket"("guestAccessTokenHash");

-- CreateIndex
CREATE INDEX "SupportTicket_guestEmail_createdAt_idx" ON "SupportTicket"("guestEmail", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
