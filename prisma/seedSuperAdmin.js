
import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/db/prisma.js";

// ==========================================
// INITIAL SUPER ADMIN BOOTSTRAP
// ==========================================

export const seedSuperAdmin = async () => {
  console.log("Starting Super Admin bootstrap...");

  const {
    SUPER_ADMIN_NAME,
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_DATE_OF_BIRTH,
    SUPER_ADMIN_GENDER,
    SUPER_ADMIN_PHONE,
  } = process.env;

  // ==========================================
  // VALIDATE REQUIRED ENVIRONMENT VARIABLES
  // ==========================================

  const requiredVariables = {
    SUPER_ADMIN_NAME,
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_DATE_OF_BIRTH,
    SUPER_ADMIN_GENDER,
  };

  const missingVariables = Object.entries(requiredVariables)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingVariables.join(", ")}`
    );
  }

  const name = SUPER_ADMIN_NAME.trim();
  const email = SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const password = SUPER_ADMIN_PASSWORD;
  const gender = SUPER_ADMIN_GENDER.trim().toUpperCase();

  // ==========================================
  // VALIDATE INPUT
  // ==========================================

  if (name.length < 2) {
    throw new Error(
      "Super Admin name must contain at least 2 characters."
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Super Admin password must contain at least 8 characters."
    );
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
    throw new Error(
      "SUPER_ADMIN_GENDER must be MALE, FEMALE, or OTHER."
    );
  }

  // ==========================================
  // VALIDATE DATE OF BIRTH
  // ==========================================

  const dateOfBirth = new Date(
    `${SUPER_ADMIN_DATE_OF_BIRTH}T00:00:00.000Z`
  );

  if (
    Number.isNaN(dateOfBirth.getTime()) ||
    dateOfBirth.toISOString().slice(0, 10) !==
      SUPER_ADMIN_DATE_OF_BIRTH
  ) {
    throw new Error(
      "SUPER_ADMIN_DATE_OF_BIRTH must use YYYY-MM-DD format."
    );
  }

  if (dateOfBirth >= new Date()) {
    throw new Error("Date of birth must be in the past.");
  }

  // ==========================================
  // CHECK EXISTING SUPER ADMIN
  // ==========================================

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (existingUser) {
    if (existingUser.role === "SUPER_ADMIN") {
      console.log(
        "A Super Admin account with this email already exists."
      );
      console.log("Super Admin bootstrap skipped.");
      return;
    }

    throw new Error(
      "This email already belongs to another account. Use a different email."
    );
  }

  // ==========================================
  // HASH PASSWORD
  // ==========================================

  const hashedPassword = await bcrypt.hash(password, 12);

  // ==========================================
  // CREATE INITIAL SUPER ADMIN
  // ==========================================

  const superAdmin = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      dateOfBirth,
      gender,
      phone: SUPER_ADMIN_PHONE?.trim() || null,

      role: "SUPER_ADMIN",

      isActive: true,
      isVerified: true,

      // Super Admin does not need an Admin Role.
      // Authorization is handled through the
      // Super Admin bypass in backend middleware.
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
    },
  });

  console.log("==========================================");
  console.log("SUPER ADMIN CREATED SUCCESSFULLY");
  console.log("==========================================");
  console.log(superAdmin);
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default seedSuperAdmin;
