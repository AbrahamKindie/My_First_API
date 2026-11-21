
BEGIN;

-- ==========================================
-- STEP 1: CREATE A TEMPORARY ENUM
-- Keep both old and new permission values.
-- ==========================================

CREATE TYPE "AdminPermission_transition" AS ENUM (
  'VIEW_USERS',
  'CREATE_USERS',
  'UPDATE_USERS',
  'DELETE_USERS',
  'ACTIVATE_USERS',
  'DEACTIVATE_USERS',

  'VIEW_SHOPS',
  'APPROVE_SHOPS',
  'REJECT_SHOPS',
  'UPDATE_SHOPS',
  'SUSPEND_SHOPS',
  'REACTIVATE_SHOPS',

  'VIEW_PRODUCTS',
  'CREATE_PRODUCTS',
  'UPDATE_PRODUCTS',
  'DELETE_PRODUCTS',
  'FEATURE_PRODUCTS',

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
  'UPDATE_SETTINGS',

  -- Old permissions (temporary)
  'MANAGE_USERS',
  'MANAGE_SHOPS',
  'MANAGE_PRODUCTS',
  'MANAGE_CATEGORIES',
  'MANAGE_ORDERS',
  'MANAGE_PAYMENTS',
  'MANAGE_DISCOUNTS',
  'MANAGE_REVIEWS',
  'MANAGE_NOTIFICATIONS',
  'MANAGE_SETTINGS'
);

-- ==========================================
-- STEP 2: CONVERT THE COLUMN TO TEMP ENUM
-- ==========================================

ALTER TABLE "User"
ALTER COLUMN "adminPermissions" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "adminPermissions"
TYPE "AdminPermission_transition"[]
USING ("adminPermissions"::text[]::"AdminPermission_transition"[]);

ALTER TYPE "AdminPermission" RENAME TO "AdminPermission_old";

ALTER TYPE "AdminPermission_transition"
RENAME TO "AdminPermission";

DROP TYPE "AdminPermission_old";

-- ==========================================
-- STEP 3: MAP OLD PERMISSIONS TO NEW ONES
-- Preserve all existing Admin permissions.
-- ==========================================

UPDATE "User" AS u
SET "adminPermissions" = (
  SELECT COALESCE(
    array_agg(
      DISTINCT expanded.permission::"AdminPermission"
      ORDER BY expanded.permission::"AdminPermission"
    ),
    ARRAY[]::"AdminPermission"[]
  )
  FROM unnest(u."adminPermissions") AS old(permission)
  CROSS JOIN LATERAL unnest(
    CASE old.permission::text

      WHEN 'MANAGE_USERS' THEN ARRAY[
        'VIEW_USERS',
        'CREATE_USERS',
        'UPDATE_USERS',
        'DELETE_USERS',
        'ACTIVATE_USERS',
        'DEACTIVATE_USERS'
      ]

      WHEN 'MANAGE_SHOPS' THEN ARRAY[
        'VIEW_SHOPS',
        'APPROVE_SHOPS',
        'REJECT_SHOPS',
        'UPDATE_SHOPS',
        'SUSPEND_SHOPS',
        'REACTIVATE_SHOPS'
      ]

      WHEN 'MANAGE_PRODUCTS' THEN ARRAY[
        'VIEW_PRODUCTS',
        'CREATE_PRODUCTS',
        'UPDATE_PRODUCTS',
        'DELETE_PRODUCTS',
        'FEATURE_PRODUCTS'
      ]

      WHEN 'MANAGE_CATEGORIES' THEN ARRAY[
        'VIEW_CATEGORIES',
        'CREATE_CATEGORIES',
        'UPDATE_CATEGORIES',
        'DELETE_CATEGORIES'
      ]

      WHEN 'MANAGE_ORDERS' THEN ARRAY[
        'VIEW_ORDERS',
        'UPDATE_ORDERS',
        'CANCEL_ORDERS'
      ]

      WHEN 'MANAGE_PAYMENTS' THEN ARRAY[
        'VIEW_PAYMENTS',
        'UPDATE_PAYMENTS',
        'REFUND_PAYMENTS'
      ]

      WHEN 'MANAGE_DISCOUNTS' THEN ARRAY[
        'VIEW_DISCOUNTS',
        'CREATE_DISCOUNTS',
        'UPDATE_DISCOUNTS',
        'DELETE_DISCOUNTS'
      ]

      WHEN 'MANAGE_REVIEWS' THEN ARRAY[
        'VIEW_REVIEWS',
        'DELETE_REVIEWS'
      ]

      WHEN 'MANAGE_NOTIFICATIONS' THEN ARRAY[
        'VIEW_NOTIFICATIONS',
        'CREATE_NOTIFICATIONS',
        'UPDATE_NOTIFICATIONS',
        'DELETE_NOTIFICATIONS',
        'SEND_NOTIFICATIONS'
      ]

      WHEN 'MANAGE_SETTINGS' THEN ARRAY[
        'VIEW_SETTINGS',
        'UPDATE_SETTINGS'
      ]

      ELSE ARRAY[old.permission::text]

    END
  ) AS expanded(permission)
);

-- ==========================================
-- STEP 4: CREATE THE FINAL ENUM
-- Only granular permissions remain.
-- ==========================================

CREATE TYPE "AdminPermission_final" AS ENUM (
  'VIEW_USERS',
  'CREATE_USERS',
  'UPDATE_USERS',
  'DELETE_USERS',
  'ACTIVATE_USERS',
  'DEACTIVATE_USERS',

  'VIEW_SHOPS',
  'APPROVE_SHOPS',
  'REJECT_SHOPS',
  'UPDATE_SHOPS',
  'SUSPEND_SHOPS',
  'REACTIVATE_SHOPS',

  'VIEW_PRODUCTS',
  'CREATE_PRODUCTS',
  'UPDATE_PRODUCTS',
  'DELETE_PRODUCTS',
  'FEATURE_PRODUCTS',

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

-- ==========================================
-- STEP 5: CONVERT TO THE FINAL ENUM
-- ==========================================

ALTER TABLE "User"
ALTER COLUMN "adminPermissions" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "adminPermissions"
TYPE "AdminPermission_final"[]
USING ("adminPermissions"::text[]::"AdminPermission_final"[]);

DROP TYPE "AdminPermission";

ALTER TYPE "AdminPermission_final"
RENAME TO "AdminPermission";

ALTER TABLE "User"
ALTER COLUMN "adminPermissions"
SET DEFAULT ARRAY[]::"AdminPermission"[];

COMMIT;
