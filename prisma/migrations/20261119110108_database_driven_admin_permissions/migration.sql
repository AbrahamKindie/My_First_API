/*
  Warnings:

  - You are about to drop the column `permission` on the `AdminRolePermission` table. All the data in the column will be lost.
  - You are about to drop the column `adminPermissions` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roleId,permissionId]` on the table `AdminRolePermission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `permissionId` to the `AdminRolePermission` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AdminRolePermission_permission_idx";

-- DropIndex
DROP INDEX "AdminRolePermission_roleId_permission_key";

-- AlterTable
ALTER TABLE "AdminRolePermission" DROP COLUMN "permission",
ADD COLUMN     "permissionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "adminPermissions";

-- DropEnum
DROP TYPE "AdminPermission";

-- CreateTable
CREATE TABLE "AdminPermission" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermission_key_key" ON "AdminPermission"("key");

-- CreateIndex
CREATE INDEX "AdminPermission_group_isActive_idx" ON "AdminPermission"("group", "isActive");

-- CreateIndex
CREATE INDEX "AdminPermission_isActive_idx" ON "AdminPermission"("isActive");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permissionId_idx" ON "AdminRolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permissionId_key" ON "AdminRolePermission"("roleId", "permissionId");

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
