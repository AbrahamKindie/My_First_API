-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminPermission" ADD VALUE 'ACTIVATE_PRODUCTS';
ALTER TYPE "AdminPermission" ADD VALUE 'VIEW_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'CREATE_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'UPDATE_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'ACTIVATE_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'DEACTIVATE_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'DELETE_ADMINS';
ALTER TYPE "AdminPermission" ADD VALUE 'MANAGE_ADMIN_PERMISSIONS';
ALTER TYPE "AdminPermission" ADD VALUE 'RESEND_ADMIN_SETUP_EMAIL';
