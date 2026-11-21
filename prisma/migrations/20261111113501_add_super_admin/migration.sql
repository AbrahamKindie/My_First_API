-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('MANAGE_USERS', 'MANAGE_SHOPS', 'MANAGE_PRODUCTS', 'MANAGE_CATEGORIES', 'MANAGE_ORDERS', 'MANAGE_PAYMENTS', 'MANAGE_DISCOUNTS', 'MANAGE_REVIEWS', 'MANAGE_NOTIFICATIONS', 'VIEW_REPORTS', 'MANAGE_SETTINGS');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPermissions" "AdminPermission"[] DEFAULT ARRAY[]::"AdminPermission"[];

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActivityLog_actorId_createdAt_idx" ON "AdminActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");

-- CreateIndex
CREATE INDEX "AdminActivityLog_targetType_targetId_idx" ON "AdminActivityLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
