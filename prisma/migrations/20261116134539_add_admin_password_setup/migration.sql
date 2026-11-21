/*
  Warnings:

  - A unique constraint covering the columns `[adminPasswordSetupToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPasswordSetupCompleted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "adminPasswordSetupExpires" TIMESTAMP(3),
ADD COLUMN     "adminPasswordSetupToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_adminPasswordSetupToken_key" ON "User"("adminPasswordSetupToken");
