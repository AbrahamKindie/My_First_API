
import prisma from "../src/db/prisma.js";
import { seedAdminPermissions } from "./seedAdminPermissions.js";
import { seedSuperAdmin } from "./seedSuperAdmin.js";

// ==========================================
// SHOP EASE DATABASE SEEDING
// ==========================================

async function main() {
  console.log("==========================================");
  console.log("Starting ShopEase database seeding...");
  console.log("==========================================");

  // ==========================================
  // 1. SEED ADMIN PERMISSIONS AND DEFAULT ROLE
  // ==========================================

  await seedAdminPermissions();

  // ==========================================
  // 2. BOOTSTRAP INITIAL SUPER ADMIN
  // ==========================================

  await seedSuperAdmin();

  console.log("==========================================");
  console.log("ShopEase database seeding completed successfully!");
  console.log("==========================================");
}

// ==========================================
// EXECUTE SEEDING
// ==========================================

main()
  .catch((error) => {
    console.error("==========================================");
    console.error("ShopEase database seeding failed!");
    console.error(error);
    console.error("==========================================");

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  await prisma.shopCategory.upsert({
  where: {
    name: "Other",
  },
  update: {},
  create: {
    name: "Other",
    description: "custom shop category.",
  },
});
