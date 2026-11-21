
import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

// ==========================================
// DATABASE CONFIGURATION
// ==========================================

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables.");
}

// ==========================================
// PRISMA CLIENT
// ==========================================

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
  });
};

// Reuse Prisma client during development
const prisma =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
