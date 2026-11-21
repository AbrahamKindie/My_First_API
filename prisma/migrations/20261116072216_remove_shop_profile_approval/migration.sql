
-- ============================================
-- 1. UPDATE ADMIN PERMISSIONS
-- ============================================

BEGIN;

CREATE TYPE "AdminPermission_new" AS ENUM (
  'VIEW_USERS',
  'CREATE_USERS',
  'UPDATE_USERS',
  'DELETE_USERS',
  'ACTIVATE_USERS',
  'DEACTIVATE_USERS',

  'VIEW_SHOPS',
  'UPDATE_SHOPS',
  'ACTIVATE_SHOPS',
  'DEACTIVATE_SHOPS',

  'VIEW_PRODUCTS',
  'DEACTIVATE_PRODUCTS',

  'VIEW_CATEGORIES',
  'CREATE_CATEGORIES',
  'UPDATE_CATEGORIES',
  'DELETE_CATEGORIES',

  'VIEW_ORDERS',
  'UPDATE_ORDERS',
  'CANCEL_ORDERS',

  'VIEW_PAYMENTS',
  'UPDATE_PAYMENTS',
  'REFUND_PAYMENTS',

  'VIEW_DISCOUNTS',
  'CREATE_DISCOUNTS',
  'UPDATE_DISCOUNTS',
  'DELETE_DISCOUNTS',

  'VIEW_REVIEWS',
  'DELETE_REVIEWS',

  'VIEW_PRODUCT_REPORTS',
  'REVIEW_PRODUCT_REPORTS',

  'VIEW_NOTIFICATIONS',
  'CREATE_NOTIFICATIONS',
  'UPDATE_NOTIFICATIONS',
  'DELETE_NOTIFICATIONS',
  'SEND_NOTIFICATIONS',

  'VIEW_REPORTS',
  'EXPORT_REPORTS',

  'VIEW_SETTINGS',
  'UPDATE_SETTINGS'
);

-- Remove the old column default before changing its enum type.

ALTER TABLE "User"
ALTER COLUMN "adminPermissions" DROP DEFAULT;

-- Create a temporary column using the new enum type.
-- This avoids using a subquery inside ALTER COLUMN USING.

ALTER TABLE "User"
ADD COLUMN "adminPermissions_new"
"AdminPermission_new"[]
NOT NULL
DEFAULT ARRAY[]::"AdminPermission_new"[];

-- Convert existing permissions and preserve their values.
-- Old permissions are mapped to their new equivalents.
-- MANAGE_PRODUCTS becomes VIEW_PRODUCTS and DEACTIVATE_PRODUCTS.
-- REVIEW_SHOP_PROFILE_CHANGES is removed.
-- Duplicate permissions are eliminated.

UPDATE "User" AS u
SET "adminPermissions_new" = COALESCE(
  (
    SELECT ARRAY_AGG(
      d.permission::"AdminPermission_new"
      ORDER BY d.first_position, d.permission
    )
    FROM (
      SELECT
        mapped.permission,
        MIN(mapped.position) AS first_position
      FROM (
        -- Preserve and map existing permissions.
        SELECT
          CASE old.permission::text
            WHEN 'APPROVE_SHOPS' THEN 'ACTIVATE_SHOPS'
            WHEN 'REACTIVATE_SHOPS' THEN 'ACTIVATE_SHOPS'
            WHEN 'REJECT_SHOPS' THEN 'DEACTIVATE_SHOPS'
            WHEN 'SUSPEND_SHOPS' THEN 'DEACTIVATE_SHOPS'
            WHEN 'MANAGE_PRODUCTS' THEN 'VIEW_PRODUCTS'
            ELSE old.permission::text
          END AS permission,
          old.position
        FROM UNNEST(u."adminPermissions")
          WITH ORDINALITY AS old(permission, position)
        WHERE old.permission::text <>
          'REVIEW_SHOP_PROFILE_CHANGES'

        UNION ALL

        -- Give previous MANAGE_PRODUCTS admins the
        -- new DEACTIVATE_PRODUCTS permission as well.
        SELECT
          'DEACTIVATE_PRODUCTS'::text AS permission,
          old.position
        FROM UNNEST(u."adminPermissions")
          WITH ORDINALITY AS old(permission, position)
        WHERE old.permission::text = 'MANAGE_PRODUCTS'

      ) AS mapped
      WHERE mapped.permission IS NOT NULL
      GROUP BY mapped.permission
    ) AS d
  ),
  ARRAY[]::"AdminPermission_new"[]
);

-- Replace the old column.

ALTER TABLE "User"
DROP COLUMN "adminPermissions";

ALTER TABLE "User"
RENAME COLUMN "adminPermissions_new"
TO "adminPermissions";

-- Replace the old enum.

ALTER TYPE "AdminPermission"
RENAME TO "AdminPermission_old";

ALTER TYPE "AdminPermission_new"
RENAME TO "AdminPermission";

DROP TYPE "AdminPermission_old";

-- Restore the default.

ALTER TABLE "User"
ALTER COLUMN "adminPermissions"
SET DEFAULT ARRAY[]::"AdminPermission"[];

COMMIT;


-- ============================================
-- 2. UPDATE SHOP STATUSES
-- ============================================

BEGIN;

CREATE TYPE "ShopStatus_new" AS ENUM (
  'ACTIVE',
  'DEACTIVATED'
);

ALTER TABLE "Shop"
ALTER COLUMN "status" DROP DEFAULT;

-- Map all existing shop statuses.

ALTER TABLE "Shop"
ALTER COLUMN "status"
TYPE "ShopStatus_new"
USING (
  CASE "status"::text
    WHEN 'APPROVED' THEN 'ACTIVE'
    WHEN 'PENDING' THEN 'ACTIVE'
    WHEN 'REJECTED' THEN 'DEACTIVATED'
    WHEN 'SUSPENDED' THEN 'DEACTIVATED'
    WHEN 'ACTIVE' THEN 'ACTIVE'
    WHEN 'DEACTIVATED' THEN 'DEACTIVATED'
    ELSE NULL
  END
)::"ShopStatus_new";

ALTER TYPE "ShopStatus"
RENAME TO "ShopStatus_old";

ALTER TYPE "ShopStatus_new"
RENAME TO "ShopStatus";

DROP TYPE "ShopStatus_old";

-- New shops are active by default.

ALTER TABLE "Shop"
ALTER COLUMN "status"
SET DEFAULT 'ACTIVE'::"ShopStatus";

COMMIT;


-- ============================================
-- 3. REMOVE SHOP PROFILE APPROVAL WORKFLOW
-- ============================================

-- Remove foreign-key constraints first.

ALTER TABLE "ShopProfileChangeRequest"
DROP CONSTRAINT IF EXISTS
"ShopProfileChangeRequest_reviewedById_fkey";

ALTER TABLE "ShopProfileChangeRequest"
DROP CONSTRAINT IF EXISTS
"ShopProfileChangeRequest_shopId_fkey";

-- Remove the old shop rejection field.

ALTER TABLE "Shop"
DROP COLUMN IF EXISTS "rejectionReason";

-- Remove the approval request table.

DROP TABLE IF EXISTS "ShopProfileChangeRequest";

-- Remove the old approval status enum.

DROP TYPE IF EXISTS "ShopProfileChangeStatus";
