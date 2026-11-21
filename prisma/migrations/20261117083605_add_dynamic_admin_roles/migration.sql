-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminPermission" ADD VALUE 'VIEW_ADMIN_ROLES';
ALTER TYPE "AdminPermission" ADD VALUE 'CREATE_ADMIN_ROLES';
ALTER TYPE "AdminPermission" ADD VALUE 'UPDATE_ADMIN_ROLES';
ALTER TYPE "AdminPermission" ADD VALUE 'DELETE_ADMIN_ROLES';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_ADMIN_ROLE_PERMISSIONS';
ALTER TYPE "AdminPermission" ADD VALUE 'ASSIGN_ADMIN_ROLES';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRoleId" INTEGER;

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permission" "AdminPermission" NOT NULL,

    CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- CreateIndex
CREATE INDEX "AdminRole_isActive_idx" ON "AdminRole"("isActive");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permission_idx" ON "AdminRolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permission_key" ON "AdminRolePermission"("roleId", "permission");

-- CreateIndex
CREATE INDEX "User_adminRoleId_idx" ON "User"("adminRoleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_adminRoleId_fkey" FOREIGN KEY ("adminRoleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
