
import prisma from "../src/db/prisma.js";

// ==========================================
// AVAILABLE ADMIN PERMISSIONS
// DATABASE-DRIVEN PERMISSION CATALOG
// ==========================================

const permissionGroups = {
  "User Management": [
    "VIEW_USERS",
    "CREATE_USERS",
    "UPDATE_USERS",
    "DELETE_USERS",
    "ACTIVATE_USERS",
    "DEACTIVATE_USERS",
  ],

  "Shop Management": [
    "VIEW_SHOPS",
    "UPDATE_SHOPS",
    "ACTIVATE_SHOPS",
    "DEACTIVATE_SHOPS",
  ],

  "Product Management": [
    "VIEW_PRODUCTS",
    "ACTIVATE_PRODUCTS",
    "DEACTIVATE_PRODUCTS",
  ],

  "Admin Management": [
    "VIEW_ADMINS",
    "CREATE_ADMINS",
    "UPDATE_ADMINS",
    "ACTIVATE_ADMINS",
    "DEACTIVATE_ADMINS",
    "DELETE_ADMINS",
    "RESEND_ADMIN_SETUP_EMAIL",
  ],

  "Admin Role Management": [
    "VIEW_ADMIN_ROLES",
    "CREATE_ADMIN_ROLES",
    "UPDATE_ADMIN_ROLES",
    "DELETE_ADMIN_ROLES",
    "MANAGE_ADMIN_ROLE_PERMISSIONS",
    "ASSIGN_ADMIN_ROLES",
  ],

  "Activity Logs": [
    "VIEW_ACTIVITY_LOGS",
  ],

  "Category Management": [
    "VIEW_CATEGORIES",
    "CREATE_CATEGORIES",
    "UPDATE_CATEGORIES",
    "DELETE_CATEGORIES",
  ],

  "Order Management": [
    "VIEW_ORDERS",
    "UPDATE_ORDERS",
    "CANCEL_ORDERS",
  ],

  "Payment Management": [
    "VIEW_PAYMENTS",
    "UPDATE_PAYMENTS",
    "REFUND_PAYMENTS",
  ],

  "Discount Management": [
    "VIEW_DISCOUNTS",
    "CREATE_DISCOUNTS",
    "UPDATE_DISCOUNTS",
    "DELETE_DISCOUNTS",
  ],

  "Review Management": [
    "VIEW_REVIEWS",
    "DELETE_REVIEWS",
  ],

  "Product Report Management": [
    "VIEW_PRODUCT_REPORTS",
    "REVIEW_PRODUCT_REPORTS",
  ],

  "Notification Management": [
    "VIEW_NOTIFICATIONS",
    "CREATE_NOTIFICATIONS",
    "UPDATE_NOTIFICATIONS",
    "DELETE_NOTIFICATIONS",
    "SEND_NOTIFICATIONS",
  ],

  "Reports and Analytics": [
    "VIEW_REPORTS",
    "EXPORT_REPORTS",
  ],

  "System Settings": [
    "VIEW_SETTINGS",
    "UPDATE_SETTINGS",
  ],
};

// ==========================================
// LEGACY PERMISSIONS
// ==========================================

const legacyPermissions = [
  "MANAGE_ADMIN_PERMISSIONS",
];

// ==========================================
// BUILD PERMISSION RECORDS
// ==========================================

const permissions = Object.entries(permissionGroups).flatMap(
  ([group, keys]) =>
    keys.map((key) => ({
      key,
      group,
      label: key
        .split("_")
        .map(
          (word) =>
            word.charAt(0) + word.slice(1).toLowerCase()
        )
        .join(" "),
      isActive: true,
    }))
);

// ==========================================
// REMOVE DUPLICATE PERMISSION DEFINITIONS
// ==========================================

const uniquePermissions = [
  ...new Map(
    permissions.map((permission) => [
      permission.key,
      permission,
    ])
  ).values(),
];

// ==========================================
// SEED ADMIN PERMISSIONS AND DEFAULT ROLE
// ==========================================

export async function seedAdminPermissions() {
  console.log("Starting Admin permissions seeding...");

  await prisma.$transaction(
    async (tx) => {
      // ==========================================
      // 1. CREATE OR UPDATE PERMISSION RECORDS
      // ==========================================

      const savedPermissions = [];

      for (const permission of uniquePermissions) {
        const savedPermission =
          await tx.adminPermission.upsert({
            where: {
              key: permission.key,
            },

            update: {
              group: permission.group,
              label: permission.label,
              isActive: true,
            },

            create: {
              key: permission.key,
              group: permission.group,
              label: permission.label,
              isActive: true,
            },
          });

        savedPermissions.push(savedPermission);
      }

      // ==========================================
      // 2. DEACTIVATE LEGACY PERMISSIONS
      // ==========================================

      await tx.adminPermission.updateMany({
        where: {
          key: {
            in: legacyPermissions,
          },
        },

        data: {
          isActive: false,
        },
      });

      // ==========================================
      // 3. CREATE OR UPDATE DEFAULT ADMIN ROLE
      // ==========================================

      const defaultAdminRole =
        await tx.adminRole.upsert({
          where: {
            name: "Admin",
          },

          update: {
            description:
              "Default role for system administrators",
            isActive: true,
          },

          create: {
            name: "Admin",
            description:
              "Default role for system administrators",
            isActive: true,
          },
        });

      // ==========================================
      // 4. REMOVE EXISTING DEFAULT ROLE PERMISSIONS
      // ==========================================

      await tx.adminRolePermission.deleteMany({
        where: {
          roleId: defaultAdminRole.id,
        },
      });

      // ==========================================
      // 5. ASSIGN ALL ACTIVE SEEDED PERMISSIONS
      // ==========================================

      await tx.adminRolePermission.createMany({
        data: savedPermissions.map((permission) => ({
          roleId: defaultAdminRole.id,
          permissionId: permission.id,
        })),
      });

      // ==========================================
      // 6. LOG SEEDING RESULTS
      // ==========================================

      console.log("----------------------------------");
      console.log("Admin Permission Seeding Results");
      console.log("----------------------------------");
      console.log(`Admin Role: ${defaultAdminRole.name}`);
      console.log(
        `Permission Groups: ${Object.keys(permissionGroups).length}`
      );
      console.log(
        `Total Permissions: ${savedPermissions.length}`
      );
      console.log(
        `Legacy Permissions Deactivated: ${legacyPermissions.length}`
      );
      console.log(
        "All seeded permissions assigned to Default Admin."
      );
      console.log("----------------------------------");
    },
 {
    maxWait: 10000,
    timeout: 30000,
  }

  );

  console.log("Admin permissions seeded successfully!");
}
