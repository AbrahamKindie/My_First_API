
import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import crypto from "node:crypto";
import transporter from "../utils/email.js";
import { unlink } from "node:fs/promises";
import path from "node:path";

// ==========================================
// CONSTANTS
// ==========================================

const legacyPermissions = new Set(["MANAGE_ADMIN_PERMISSIONS"]);

const marketplaceUserRoles = ["USER", "SHOP_OWNER"];
const validShopStatuses = ["ACTIVE", "DEACTIVATED"];

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (value, label = "ID") => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    throw createError(`Invalid ${label}.`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`Invalid ${label}.`);
  }

  return id;
};

const hashSetupToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

// ==========================================
// DATE OF BIRTH VALIDATION
// STRICT YYYY-MM-DD FORMAT
// MINIMUM AGE: 18 YEARS
// DATABASE FIELD IS REQUIRED
// ==========================================

const parseDateOfBirth = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw createError(
      "Date of birth must use YYYY-MM-DD format."
    );
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError("Invalid date of birth.");
  }

  // Use UTC calendar dates consistently.
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  let age = currentYear - year;

  if (
    currentMonth < month ||
    (currentMonth === month && currentDay < day)
  ) {
    age--;
  }

  if (age < 18) {
    throw createError(
      "Admin must be at least 18 years old."
    );
  }

  if (date.getTime() > Date.now()) {
    throw createError(
      "Date of birth cannot be in the future."
    );
  }

  return date;
};

// ==========================================
// PAGINATION VALIDATION
// ==========================================

const getPagination = (filters = {}) => {
  const rawPage = filters.page ?? 1;
  const rawLimit = filters.limit ?? 20;

  const page = Number(rawPage);
  const limit = Number(rawLimit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1
  ) {
    throw createError(
      "Invalid pagination parameters."
    );
  }

  const pageSize = Math.min(limit, 100);
  const skip = (page - 1) * pageSize;

  if (!Number.isSafeInteger(skip)) {
    throw createError(
      "Requested page is too large."
    );
  }

  return {
    page,
    limit: pageSize,
    skip,
  };
};

const getPaginationResult = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1,
});

// ==========================================
// CATEGORY IMAGE CLEANUP
// ONLY DELETE FILES IN CATEGORY DIRECTORY
// ==========================================

const deleteShopCategoryImageFile = async (imagePath) => {
  if (
    typeof imagePath !== "string" ||
    !imagePath.startsWith("/uploads/categories/")
  ) {
    return;
  }

  const filename = path.basename(imagePath);

  if (
    !filename ||
    filename === "." ||
    filename === ".."
  ) {
    return;
  }

  const uploadDirectory = path.resolve(
    process.cwd(),
    "uploads",
    "categories"
  );

  const filePath = path.resolve(
    uploadDirectory,
    filename
  );

  // Ensure the resolved path remains inside the category folder.
  if (path.dirname(filePath) !== uploadDirectory) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "[SHOP CATEGORY IMAGE CLEANUP ERROR]",
        error
      );
    }
  }
};

// ==========================================
// ADMIN ROLE HELPERS
// DATABASE-DRIVEN PERMISSIONS
// ==========================================

const adminRoleInclude = {
  adminRole: {
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      permissions: {
        where: {
          permission: {
            isActive: true,
          },
        },
        select: {
          permission: {
            select: {
              key: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          permission: {
            key: "asc",
          },
        },
      },
    },
  },
};

const getRolePermissions = (adminRole) => {
  if (!adminRole || !adminRole.isActive) {
    return [];
  }

  return [
    ...new Set(
      (adminRole.permissions || [])
        .map((item) => item.permission?.key)
        .filter(
          (key) =>
            typeof key === "string" &&
            !legacyPermissions.has(key)
        )
    ),
  ];
};

// ==========================================
// SAFE ADMIN RESPONSE
// ==========================================

const getSafeAdmin = (admin) => {
  const adminRole = admin.adminRole
    ? {
        id: admin.adminRole.id,
        name: admin.adminRole.name,
        description: admin.adminRole.description,
        isActive: admin.adminRole.isActive,
      }
    : null;

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    adminRoleId: admin.adminRoleId ?? null,
    adminRole,
    adminPermissions: getRolePermissions(admin.adminRole),
    isActive: admin.isActive,
    isVerified: admin.isVerified,
    adminPasswordSetupCompleted:
      admin.adminPasswordSetupCompleted,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
};

// ==========================================
// VALIDATE ADMIN ACTOR
// DATABASE IS THE SOURCE OF TRUTH
// ==========================================

const validateAdminActor = async (
  tx,
  actorId,
  requiredPermission
) => {
  const id = validateId(actorId, "Admin ID");

  if (
    typeof requiredPermission !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/.test(requiredPermission) ||
    legacyPermissions.has(requiredPermission)
  ) {
    throw createError(
      "Invalid or unsupported Admin permission."
    );
  }

  const actor = await tx.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      adminRoleId: true,
      ...adminRoleInclude,
    },
  });

  if (
    !actor ||
    !actor.isActive ||
    !["ADMIN", "SUPER_ADMIN"].includes(actor.role)
  ) {
    throw createError(
      "Active Admin authorization required.",
      403
    );
  }

  if (actor.role === "SUPER_ADMIN") {
    return {
      ...actor,
      adminPermissions: [],
      isSuperAdmin: true,
    };
  }

  if (!actor.adminRoleId || !actor.adminRole) {
    throw createError(
      "Your Admin account does not have an assigned role.",
      403
    );
  }

  if (!actor.adminRole.isActive) {
    throw createError(
      "Your assigned Admin role is inactive.",
      403
    );
  }

  const permissions = getRolePermissions(actor.adminRole);

  if (!permissions.includes(requiredPermission)) {
    throw createError(
      "You do not have permission to perform this action.",
      403
    );
  }

  return {
    ...actor,
    adminPermissions: permissions,
    isSuperAdmin: false,
  };
};

// ==========================================
// WRITE ADMIN ACTIVITY LOG
// ==========================================

const createAdminActivity = async (
  tx,
  actorId,
  action,
  targetType,
  targetId,
  details = {}
) => {
  return tx.adminActivityLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      details,
    },
  });
};

// ==========================================
// FORMAT ACTIVITY LOG
// SUPPORT DELETED ADMIN ACTORS
// ==========================================

const formatActivityLog = (log) => {
  if (log.actor) {
    return log;
  }

  const snapshot = log.details?.actorSnapshot;

  if (!snapshot) {
    return {
      ...log,
      actor: null,
    };
  }

  return {
    ...log,
    actor: {
      id: snapshot.id ?? null,
      name: snapshot.name,
      email: snapshot.email,
      role: snapshot.role,
      isDeleted: true,
    },
  };
};

// ==========================================
// CREATE ADMIN
// CREATE_ADMINS + ASSIGN_ADMIN_ROLES
// ==========================================

export const createAdmin = async (data, actorId) => {
  const name =
    typeof data.name === "string" ? data.name.trim() : "";

  const email =
    typeof data.email === "string"
      ? data.email.trim().toLowerCase()
      : "";

  const phone =
    typeof data.phone === "string"
      ? data.phone.trim() || null
      : null;

  const adminRoleId = validateId(
    data.adminRoleId,
    "Admin role ID"
  );

  const dateOfBirth = parseDateOfBirth(data.dateOfBirth);

  const gender =
    typeof data.gender === "string"
      ? data.gender.trim().toUpperCase()
      : "";

  if (!name || name.length < 2 || name.length > 100) {
    throw createError(
      "Admin name must contain between 2 and 100 characters."
    );
  }

  if (!email) {
    throw createError("Admin email is required.");
  }

  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
    throw createError("A valid gender is required.");
  }

  if (!process.env.FRONTEND_URL) {
    throw createError(
      "Frontend URL configuration is missing.",
      500
    );
  }

  const setupToken = crypto.randomBytes(32).toString("hex");
  const hashedSetupToken = hashSetupToken(setupToken);

  const setupTokenExpiry = new Date(
    Date.now() + 30 * 60 * 1000
  );

  const temporaryPassword = crypto.randomBytes(48).toString("hex");

  const hashedTemporaryPassword = await bcrypt.hash(
    temporaryPassword,
    12
  );

  let admin;

  try {
    admin = await prisma.$transaction(async (tx) => {
      const actor = await validateAdminActor(
        tx,
        actorId,
        "CREATE_ADMINS"
      );

      if (
        actor.role !== "SUPER_ADMIN" &&
        !actor.adminPermissions.includes("ASSIGN_ADMIN_ROLES")
      ) {
        throw createError(
          "You do not have permission to assign Admin roles.",
          403
        );
      }

      const role = await tx.adminRole.findUnique({
        where: { id: adminRoleId },
        include: {
          permissions: {
            where: {
              permission: {
                isActive: true,
              },
            },
            select: {
              permission: {
                select: {
                  key: true,
                  isActive: true,
                },
              },
            },
            orderBy: {
              permission: {
                key: "asc",
              },
            },
          },
        },
      });

      if (!role || !role.isActive) {
        throw createError(
          "The selected Admin role does not exist or is inactive."
        );
      }

      if (actor.role !== "SUPER_ADMIN") {
        const actorPermissions = actor.adminPermissions || [];

        const unauthorizedPermissions = role.permissions
          .map((item) => item.permission?.key)
          .filter(
            (permission) =>
              typeof permission === "string" &&
              !legacyPermissions.has(permission) &&
              !actorPermissions.includes(permission)
          );

        if (unauthorizedPermissions.length > 0) {
          throw createError(
            `You cannot assign a role containing permissions you do not possess: ${unauthorizedPermissions.join(", ")}`,
            403
          );
        }
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw createError(
          "An account with this email already exists.",
          409
        );
      }

      const createdAdmin = await tx.user.create({
        data: {
          name,
          email,
          phone,
          dateOfBirth,
          gender,
          password: hashedTemporaryPassword,
          role: "ADMIN",
          adminRoleId: role.id,
          isActive: true,
          isVerified: true,
          adminPasswordSetupToken: hashedSetupToken,
          adminPasswordSetupExpires: setupTokenExpiry,
          adminPasswordSetupCompleted: false,
        },
        include: adminRoleInclude,
      });

      await createAdminActivity(
        tx,
        actor.id,
        "CREATE_ADMIN",
        "USER",
        createdAdmin.id,
        {
          name: createdAdmin.name,
          email: createdAdmin.email,
          adminRole: {
            id: role.id,
            name: role.name,
          },
          permissions: getRolePermissions(
            createdAdmin.adminRole
          ),
          passwordSetupRequired: true,
        }
      );

      return createdAdmin;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "An account with this email or phone number already exists.",
        409
      );
    }

    throw error;
  }

  const frontendUrl = process.env.FRONTEND_URL.replace(
    /\/+$/,
    ""
  );

  const setupLink =
    `${frontendUrl}/admin/set-password?token=${setupToken}`;

  const safeName = escapeHtml(admin.name);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: admin.email,
      subject: "ShopEase Admin - Set Your Password",
      text: `
Hello ${admin.name},

Your ShopEase administrator account has been created.

Please use the link below to create your password:

${setupLink}

This link expires in 30 minutes and can only be used once.

Thank you,
ShopEase Team
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333333;">
          <h2>Welcome to ShopEase Admin</h2>
          <p>Hello ${safeName},</p>
          <p>Your ShopEase administrator account has been created. Please create your password using the button below.</p>
          <p style="margin: 30px 0;">
            <a href="${setupLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Set My Password
            </a>
          </p>
          <p>This link expires in <strong>30 minutes</strong> and can only be used once.</p>
          <p>Thank you,<br />ShopEase Team</p>
        </div>
      `,
    });

    return {
      success: true,
      setupEmailSent: true,
      admin: getSafeAdmin(admin),
      message:
        "Admin account created and password setup email sent successfully.",
    };
  } catch (emailError) {
    console.error(
      "Admin password setup email failed:",
      emailError
    );

    return {
      success: true,
      setupEmailSent: false,
      admin: getSafeAdmin(admin),
      message:
        "Admin account created, but the password setup email could not be sent. Please resend the setup email.",
    };
  }
};

// ==========================================
// RESEND ADMIN PASSWORD SETUP EMAIL
// ==========================================

export const resendAdminPasswordSetupEmail = async (
  adminId,
  actorId
) => {
  const id = validateId(adminId, "Admin ID");

  if (!process.env.FRONTEND_URL) {
    throw createError(
      "Frontend URL configuration is missing.",
      500
    );
  }

  const setupToken = crypto.randomBytes(32).toString("hex");
  const hashedSetupToken = hashSetupToken(setupToken);

  const setupTokenExpiry = new Date(
    Date.now() + 30 * 60 * 1000
  );

  const admin = await prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "RESEND_ADMIN_SETUP_EMAIL"
    );

    const existingAdmin = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        adminPasswordSetupCompleted: true,
      },
    });

    if (!existingAdmin || existingAdmin.role !== "ADMIN") {
      throw createError("Admin account not found.", 404);
    }

    if (!existingAdmin.isActive) {
      throw createError(
        "Cannot send a password setup email to an inactive Admin."
      );
    }

    if (existingAdmin.adminPasswordSetupCompleted) {
      throw createError(
        "This Admin has already completed password setup."
      );
    }

    const updatedCount = await tx.user.updateMany({
      where: {
        id,
        role: "ADMIN",
        isActive: true,
        adminPasswordSetupCompleted: false,
      },
      data: {
        adminPasswordSetupToken: hashedSetupToken,
        adminPasswordSetupExpires: setupTokenExpiry,
      },
    });

    if (updatedCount.count !== 1) {
      throw createError(
        "Admin password setup status has changed. Please try again.",
        409
      );
    }

    await createAdminActivity(
      tx,
      actor.id,
      "RESEND_ADMIN_PASSWORD_SETUP",
      "USER",
      id,
      {
        email: existingAdmin.email,
        passwordSetupRequired: true,
      }
    );

    return existingAdmin;
  });

  const frontendUrl = process.env.FRONTEND_URL.replace(
    /\/+$/,
    ""
  );

  const setupLink =
    `${frontendUrl}/admin/set-password?token=${setupToken}`;

  const safeName = escapeHtml(admin.name);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: admin.email,
      subject: "ShopEase Admin - Password Setup Link",
      text: `
Hello ${admin.name},

You have received a new ShopEase Admin password setup link.

Please use the link below to create your password:

${setupLink}

This link expires in 30 minutes and can only be used once.
Your previous setup link is no longer valid.

Thank you,
ShopEase Team
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333333;">
          <h2>ShopEase Admin Password Setup</h2>
          <p>Hello ${safeName},</p>
          <p>You have received a new password setup link for your ShopEase Admin account.</p>
          <p style="margin: 30px 0;">
            <a href="${setupLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Set My Password
            </a>
          </p>
          <p>This link expires in <strong>30 minutes</strong> and can only be used once.</p>
          <p>Your previous setup link is no longer valid.</p>
          <p>Thank you,<br />ShopEase Team</p>
        </div>
      `,
    });

    return {
      success: true,
      setupEmailSent: true,
      message:
        "A new password setup email has been sent successfully.",
    };
  } catch (emailError) {
    console.error(
      "Admin password setup resend failed:",
      emailError
    );

    return {
      success: false,
      setupEmailSent: false,
      message:
        "The password setup email could not be sent. Please try again.",
    };
  }
};

// ==========================================
// UPDATE ADMIN PROFILE
// ROLE ASSIGNMENT IS HANDLED SEPARATELY
// ==========================================

export const updateAdmin = async (
  adminId,
  data,
  actorId
) => {
  const id = validateId(adminId, "Admin ID");
  const updateData = {};

  if (data.name !== undefined) {
    const name =
      typeof data.name === "string" ? data.name.trim() : "";

    if (!name || name.length < 2 || name.length > 100) {
      throw createError(
        "Admin name must contain between 2 and 100 characters."
      );
    }

    updateData.name = name;
  }

  if (data.email !== undefined) {
    const email =
      typeof data.email === "string"
        ? data.email.trim().toLowerCase()
        : "";

    if (!email) {
      throw createError("Admin email is required.");
    }

    updateData.email = email;
  }

  if (data.phone !== undefined) {
    if (
      data.phone !== null &&
      typeof data.phone !== "string"
    ) {
      throw createError("Invalid phone number.");
    }

    updateData.phone = data.phone?.trim() || null;
  }

  if (data.dateOfBirth !== undefined) {
    // User.dateOfBirth is required in the Prisma schema.
    updateData.dateOfBirth = parseDateOfBirth(
      data.dateOfBirth
    );
  }

  if (data.gender !== undefined) {
    const gender =
      typeof data.gender === "string"
        ? data.gender.trim().toUpperCase()
        : "";

    if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
      throw createError("A valid gender is required.");
    }

    updateData.gender = gender;
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      "At least one Admin profile field must be provided."
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const actor = await validateAdminActor(
        tx,
        actorId,
        "UPDATE_ADMINS"
      );

      if (actor.id === id) {
        throw createError(
          "You cannot edit your own Admin information here. Please use My Account.",
          403
        );
      }

      const admin = await tx.user.findUnique({
        where: { id },
      });

      if (!admin || admin.role !== "ADMIN") {
        throw createError("Admin account not found.", 404);
      }

      if (
        updateData.email &&
        updateData.email !== admin.email
      ) {
        const duplicateEmail = await tx.user.findUnique({
          where: { email: updateData.email },
          select: { id: true },
        });

        if (duplicateEmail) {
          throw createError(
            "An account with this email already exists.",
            409
          );
        }
      }

      const updatedAdmin = await tx.user.update({
        where: { id },
        data: updateData,
        include: adminRoleInclude,
      });

      await createAdminActivity(
        tx,
        actor.id,
        "UPDATE_ADMIN",
        "USER",
        id,
        {
          previousData: {
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            dateOfBirth: admin.dateOfBirth,
            gender: admin.gender,
          },
          updatedData: updateData,
        }
      );

      return getSafeAdmin(updatedAdmin);
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "An account with this email or phone number already exists.",
        409
      );
    }

    throw error;
  }
};

// ==========================================
// ACTIVATE / DEACTIVATE ADMIN
// ==========================================

export const updateAdminStatus = async (
  adminId,
  isActive,
  actorId
) => {
  const id = validateId(adminId, "Admin ID");
  const actorUserId = validateId(actorId, "Actor ID");

  if (typeof isActive !== "boolean") {
    throw createError("isActive must be true or false.");
  }

  if (!isActive && id === actorUserId) {
    throw createError(
      "You cannot deactivate your own Admin account.",
      403
    );
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      isActive ? "ACTIVATE_ADMINS" : "DEACTIVATE_ADMINS"
    );

    const admin = await tx.user.findUnique({
      where: { id },
      include: adminRoleInclude,
    });

    if (!admin || admin.role !== "ADMIN") {
      throw createError("Admin account not found.", 404);
    }

    if (admin.isActive === isActive) {
      throw createError(
        `This Admin is already ${isActive ? "active" : "inactive"}.`
      );
    }

    if (isActive) {
      if (!admin.adminRoleId || !admin.adminRole) {
        throw createError(
          "This Admin cannot be activated because no Admin role is assigned. Assign an active role first."
        );
      }

      if (!admin.adminRole.isActive) {
        throw createError(
          "This Admin cannot be activated because their assigned role is inactive. Assign an active Admin role first."
        );
      }
    }

    const updatedAdmin = await tx.user.update({
      where: { id: admin.id },
      data: {
        isActive,
        ...(isActive === false
          ? {
              refreshToken: null,
              refreshTokenExpiry: null,
              ...(admin.adminPasswordSetupCompleted === false
                ? {
                    adminPasswordSetupToken: null,
                    adminPasswordSetupExpires: null,
                  }
                : {}),
            }
          : {}),
      },
      include: adminRoleInclude,
    });

    await createAdminActivity(
      tx,
      actor.id,
      isActive ? "ACTIVATE_ADMIN" : "DEACTIVATE_ADMIN",
      "USER",
      admin.id,
      {
        previousStatus: admin.isActive,
        newStatus: isActive,
        adminRole: admin.adminRole
          ? {
              id: admin.adminRole.id,
              name: admin.adminRole.name,
              isActive: admin.adminRole.isActive,
            }
          : null,
        passwordSetupLinkInvalidated:
          !isActive &&
          admin.adminPasswordSetupCompleted === false,
      }
    );

    return getSafeAdmin(updatedAdmin);
  });
};

// ==========================================
// PERMANENTLY DELETE ADMIN
// PRESERVE HISTORICAL ACTIVITY LOGS
// ==========================================

export const deleteAdmin = async (adminId, actorId) => {
  const id = validateId(adminId, "Admin ID");
  const actorUserId = validateId(actorId, "Actor ID");

  if (id === actorUserId) {
    throw createError(
      "You cannot delete your own Admin account.",
      403
    );
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "DELETE_ADMINS"
    );

    const admin = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        adminRoleId: true,
        adminRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw createError("Admin account not found.", 404);
    }

    const [
      orderCount,
      reviewCount,
      reportCount,
      ownedShop,
    ] = await Promise.all([
      tx.order.count({ where: { userId: id } }),
      tx.productReview.count({ where: { userId: id } }),
      tx.productReport.count({ where: { userId: id } }),
      tx.shop.findUnique({
        where: { ownerId: id },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    const dependencies = [];

    if (orderCount > 0) {
      dependencies.push(`${orderCount} order(s)`);
    }

    if (reviewCount > 0) {
      dependencies.push(`${reviewCount} product review(s)`);
    }

    if (reportCount > 0) {
      dependencies.push(
        `${reportCount} submitted product report(s)`
      );
    }

    if (ownedShop) {
      dependencies.push(`owned shop "${ownedShop.name}"`);
    }

    if (dependencies.length > 0) {
      throw createError(
        `This Admin cannot be deleted because the account has associated marketplace data: ${dependencies.join(", ")}. Resolve these records before deleting the account.`,
        409
      );
    }

    const actorSnapshot = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    const historicalLogs = await tx.adminActivityLog.findMany({
      where: { actorId: admin.id },
      select: {
        id: true,
        details: true,
      },
    });

    for (const log of historicalLogs) {
      const previousDetails = log.details;

      const detailsObject =
        previousDetails !== null &&
        typeof previousDetails === "object" &&
        !Array.isArray(previousDetails)
          ? previousDetails
          : { originalDetails: previousDetails };

      await tx.adminActivityLog.update({
        where: { id: log.id },
        data: {
          details: {
            ...detailsObject,
            actorSnapshot,
          },
        },
      });
    }

    await createAdminActivity(
      tx,
      actor.id,
      "DELETE_ADMIN",
      "USER",
      admin.id,
      {
        deletedAdmin: actorSnapshot,
        adminRoleId: admin.adminRoleId,
        adminRoleName: admin.adminRole?.name ?? null,
        historicalLogsPreserved: historicalLogs.length,
      }
    );

    await tx.user.delete({
      where: { id: admin.id },
    });

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      historicalLogsPreserved: historicalLogs.length,
    };
  });
};

// ==========================================
// GET ALL ADMINS
// ==========================================

export const getAllAdmins = async (actorId) => {
  return prisma.$transaction(async (tx) => {
    await validateAdminActor(tx, actorId, "VIEW_ADMINS");

    const admins = await tx.user.findMany({
      where: { role: "ADMIN" },
      include: adminRoleInclude,
      orderBy: { createdAt: "desc" },
    });

    return admins.map(getSafeAdmin);
  });
};

// ==========================================
// GET ADMIN ACTIVITY LOGS
// ==========================================

export const getAdminActivityLogs = async (
  actorUserId,
  filters = {}
) => {
  const id = validateId(actorUserId, "Admin ID");
  const { page, limit, skip } = getPagination(filters);

  const {
    actorId,
    action,
    targetType,
    startDate,
    endDate,
  } = filters;

  const where = {};

  if (
    actorId !== undefined &&
    actorId !== null &&
    actorId !== ""
  ) {
    const parsedActorId = validateId(
      actorId,
      "Activity actor ID"
    );

    where.OR = [
      { actorId: parsedActorId },
      {
        details: {
          path: ["actorSnapshot", "id"],
          equals: parsedActorId,
        },
      },
    ];
  }

  if (action) {
    where.action = action;
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (startDate || endDate) {
    where.createdAt = {};

    if (startDate) {
      const parsedStartDate = new Date(startDate);

      if (Number.isNaN(parsedStartDate.getTime())) {
        throw createError("Invalid start date.");
      }

      where.createdAt.gte = parsedStartDate;
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);

      if (Number.isNaN(parsedEndDate.getTime())) {
        throw createError("Invalid end date.");
      }

      where.createdAt.lte = parsedEndDate;
    }

    if (
      where.createdAt.gte &&
      where.createdAt.lte &&
      where.createdAt.gte > where.createdAt.lte
    ) {
      throw createError(
        "Start date cannot be after end date."
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(
      tx,
      id,
      "VIEW_ACTIVITY_LOGS"
    );

    const [logs, total] = await Promise.all([
      tx.adminActivityLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      }),
      tx.adminActivityLog.count({ where }),
    ]);

    return {
      logs: logs.map(formatActivityLog),
      pagination: getPaginationResult(
        total,
        page,
        limit
      ),
    };
  });
};

// ==========================================
// GET ADMIN DASHBOARD STATISTICS
// VIEW_REPORTS REQUIRED
// ==========================================

export const getAdminDashboardStats = async (actorId) => {
  const actor = await prisma.$transaction((tx) =>
    validateAdminActor(tx, actorId, "VIEW_REPORTS")
  );

  const isSuperAdmin = actor.role === "SUPER_ADMIN";
  const permissions = actor.adminPermissions || [];

  const canViewUsers =
    isSuperAdmin || permissions.includes("VIEW_USERS");

  const canViewShops =
    isSuperAdmin || permissions.includes("VIEW_SHOPS");

  const canViewProducts =
    isSuperAdmin || permissions.includes("VIEW_PRODUCTS");

  const canViewOrders =
    isSuperAdmin || permissions.includes("VIEW_ORDERS");

  const canViewActivityLogs =
    isSuperAdmin || permissions.includes("VIEW_ACTIVITY_LOGS");

  const [
    totalUsers,
    totalShopOwners,
    totalAdmins,
    totalSuperAdmins,
    activeShops,
    deactivatedShops,
    totalProducts,
    totalOrders,
    recentActivity,
  ] = await Promise.all([
    canViewUsers
      ? prisma.user.count({ where: { role: "USER" } })
      : Promise.resolve(null),

    canViewShops
      ? prisma.user.count({ where: { role: "SHOP_OWNER" } })
      : Promise.resolve(null),

    isSuperAdmin
      ? prisma.user.count({ where: { role: "ADMIN" } })
      : Promise.resolve(null),

    isSuperAdmin
      ? prisma.user.count({ where: { role: "SUPER_ADMIN" } })
      : Promise.resolve(null),

    canViewShops
      ? prisma.shop.count({ where: { status: "ACTIVE" } })
      : Promise.resolve(null),

    canViewShops
      ? prisma.shop.count({ where: { status: "DEACTIVATED" } })
      : Promise.resolve(null),

    canViewProducts
      ? prisma.product.count()
      : Promise.resolve(null),

    canViewOrders
      ? prisma.order.count()
      : Promise.resolve(null),

    canViewActivityLogs
      ? prisma.adminActivityLog.findMany({
          take: 5,
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" },
          ],
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const stats = {};

  if (canViewUsers) {
    stats.users = {
      total: totalUsers,
    };
  }

  if (canViewShops) {
    stats.shops = {
      total: activeShops + deactivatedShops,
      active: activeShops,
      deactivated: deactivatedShops,
      shopOwners: totalShopOwners,
    };
  }

  if (isSuperAdmin) {
    stats.users = {
      ...stats.users,
      admins: totalAdmins,
      superAdmins: totalSuperAdmins,
    };
  }

  if (canViewProducts) {
    stats.products = {
      total: totalProducts,
    };
  }

  if (canViewOrders) {
    stats.orders = {
      total: totalOrders,
    };
  }

  if (canViewActivityLogs) {
    stats.recentActivity = recentActivity.map(
      formatActivityLog
    );
  }

  return stats;
};

// ==========================================
// GET MARKETPLACE USERS
// ==========================================

export const getMarketplaceUsers = async (
  filters = {},
  actorId
) => {
  const { page, limit, skip } = getPagination(filters);

  const { search, role, isActive } = filters;

  if (role && !marketplaceUserRoles.includes(role)) {
    throw createError("Invalid marketplace user role.");
  }

  const where = {
    role: role || { in: marketplaceUserRoles },
  };

  if (isActive === "true" || isActive === true) {
    where.isActive = true;
  } else if (isActive === "false" || isActive === false) {
    where.isActive = false;
  }

  if (search?.trim()) {
    const searchTerm = search.trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
    ];
  }

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(tx, actorId, "VIEW_USERS");

    const [users, total] = await Promise.all([
      tx.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      }),
      tx.user.count({ where }),
    ]);

    return {
      users,
      pagination: getPaginationResult(
        total,
        page,
        limit
      ),
    };
  });
};

// ==========================================
// UPDATE MARKETPLACE USER STATUS
// ==========================================

export const updateMarketplaceUserStatus = async (
  userId,
  isActive,
  actorId
) => {
  const id = validateId(userId, "User ID");

  if (typeof isActive !== "boolean") {
    throw createError("isActive must be true or false.");
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      isActive ? "ACTIVATE_USERS" : "DEACTIVATE_USERS"
    );

    const user = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !marketplaceUserRoles.includes(user.role)) {
      throw createError("Marketplace user not found.", 404);
    }

    if (user.isActive === isActive) {
      throw createError(
        `This user is already ${isActive ? "active" : "inactive"}.`
      );
    }

    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        isActive,
        ...(isActive
          ? {}
          : {
              refreshToken: null,
              refreshTokenExpiry: null,
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await createAdminActivity(
      tx,
      actor.id,
      isActive
        ? "ACTIVATE_MARKETPLACE_USER"
        : "DEACTIVATE_MARKETPLACE_USER",
      "USER",
      id,
      {
        previousStatus: user.isActive,
        newStatus: isActive,
      }
    );

    return updatedUser;
  });
};

// ==========================================
// GET ALL SHOPS
// ==========================================

export const getAllShops = async (
  filters = {},
  actorId
) => {
  const { page, limit, skip } = getPagination(filters);
  const { search, status } = filters;

  const where = {};

  if (status) {
    if (!validShopStatuses.includes(status)) {
      throw createError("Invalid shop status filter.");
    }

    where.status = status;
  }

  if (search?.trim()) {
    const searchTerm = search.trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        shopCategory: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
      {
        phone: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        owner: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
      {
        owner: {
          is: {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(tx, actorId, "VIEW_SHOPS");

    const [shops, total] = await Promise.all([
      tx.shop.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
          shopCategory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      }),
      tx.shop.count({ where }),
    ]);

    return {
      shops,
      pagination: getPaginationResult(
        total,
        page,
        limit
      ),
    };
  });
};

// ==========================================
// GET SHOP DETAILS
// ==========================================

export const getShopById = async (shopId, actorId) => {
  const id = validateId(shopId, "Shop ID");

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(tx, actorId, "VIEW_SHOPS");

    const shop = await tx.shop.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        shopCategory: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!shop) {
      throw createError("Shop not found.", 404);
    }

    return shop;
  });
};

// ==========================================
// ACTIVATE / DEACTIVATE SHOP
// ==========================================

export const updateShopStatus = async (
  shopId,
  status,
  actorId
) => {
  const id = validateId(shopId, "Shop ID");

  if (!validShopStatuses.includes(status)) {
    throw createError("Invalid shop status.");
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      status === "ACTIVE"
        ? "ACTIVATE_SHOPS"
        : "DEACTIVATE_SHOPS"
    );

    const shop = await tx.shop.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
      },
    });

    if (!shop) {
      throw createError("Shop not found.", 404);
    }

    if (shop.status === status) {
      throw createError(
        `This shop is already ${status.toLowerCase()}.`
      );
    }

    const updatedCount = await tx.shop.updateMany({
      where: {
        id,
        status: shop.status,
      },
      data: { status },
    });

    if (updatedCount.count !== 1) {
      throw createError(
        "Shop status has changed. Please refresh and try again.",
        409
      );
    }

    await createAdminActivity(
      tx,
      actor.id,
      status === "ACTIVE"
        ? "ACTIVATE_SHOP"
        : "DEACTIVATE_SHOP",
      "SHOP",
      shop.id,
      {
        shopName: shop.name,
        ownerId: shop.ownerId,
        previousStatus: shop.status,
        newStatus: status,
      }
    );

    return tx.shop.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        shopCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
};

// ==========================================
// CREATE SHOP CATEGORY
// ==========================================

export const createShopCategory = async (data, actorId) => {
  const name =
    typeof data.name === "string" ? data.name.trim() : "";

  const description =
    typeof data.description === "string"
      ? data.description.trim() || null
      : null;

  const image = data.image || null;

  if (!name) {
    throw createError("Shop category name is required.");
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "CREATE_CATEGORIES"
    );

    const existingCategory = await tx.shopCategory.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existingCategory) {
      throw createError(
        "A shop category with this name already exists.",
        409
      );
    }

    const category = await tx.shopCategory.create({
      data: {
        name,
        description,
        image,
      },
      include: {
        _count: {
          select: { shops: true },
        },
      },
    });

    await createAdminActivity(
      tx,
      actor.id,
      "CREATE_SHOP_CATEGORY",
      "SHOP_CATEGORY",
      category.id,
      {
        name: category.name,
        description: category.description,
        image: category.image,
      }
    );

    return category;
  });
};

// ==========================================
// UPDATE SHOP CATEGORY
// SUPPORTS IMAGE-ONLY UPDATES
// ==========================================

export const updateShopCategory = async (
  categoryId,
  data,
  actorId
) => {
  const id = validateId(categoryId, "Shop category ID");

  const name =
    data.name !== undefined
      ? typeof data.name === "string"
        ? data.name.trim()
        : ""
      : undefined;

  const description =
    data.description !== undefined
      ? typeof data.description === "string"
        ? data.description.trim() || null
        : null
      : undefined;

  const image =
    data.image !== undefined ? data.image : undefined;

  if (name !== undefined && !name) {
    throw createError(
      "Shop category name cannot be empty."
    );
  }

  if (
    name === undefined &&
    description === undefined &&
    image === undefined
  ) {
    throw createError(
      "At least one category field or image must be provided."
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "UPDATE_CATEGORIES"
    );

    const category = await tx.shopCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw createError("Shop category not found.", 404);
    }

    if (name !== undefined) {
      const duplicate = await tx.shopCategory.findFirst({
        where: {
          id: { not: id },
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      });

      if (duplicate) {
        throw createError(
          "Another shop category with this name already exists.",
          409
        );
      }
    }

    const updatedCategory = await tx.shopCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
      },
      include: {
        _count: {
          select: { shops: true },
        },
      },
    });

    await createAdminActivity(
      tx,
      actor.id,
      "UPDATE_SHOP_CATEGORY",
      "SHOP_CATEGORY",
      id,
      {
        previousData: {
          name: category.name,
          description: category.description,
          image: category.image,
        },
        updatedData: {
          name: updatedCategory.name,
          description: updatedCategory.description,
          image: updatedCategory.image,
        },
      }
    );

    return {
      updatedCategory,
      previousImage: category.image,
    };
  });

  // Delete the previous image only after the DB transaction succeeds.
  if (
    result.previousImage &&
    result.previousImage !== result.updatedCategory.image
  ) {
    await deleteShopCategoryImageFile(result.previousImage);
  }

  return result.updatedCategory;
};

// ==========================================
// DELETE SHOP CATEGORY
// ==========================================

export const deleteShopCategory = async (
  categoryId,
  actorId
) => {
  const id = validateId(categoryId, "Shop category ID");

  const result = await prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "DELETE_CATEGORIES"
    );

    const category = await tx.shopCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { shops: true },
        },
      },
    });

    if (!category) {
      throw createError("Shop category not found.", 404);
    }

    if (category._count.shops > 0) {
      throw createError(
        `Cannot delete this category because ${category._count.shops} shop(s) are using it.`,
        409
      );
    }

    await createAdminActivity(
      tx,
      actor.id,
      "DELETE_SHOP_CATEGORY",
      "SHOP_CATEGORY",
      id,
      {
        name: category.name,
        description: category.description,
        image: category.image,
      }
    );

    await tx.shopCategory.delete({
      where: { id },
    });

    return {
      id: category.id,
      name: category.name,
      image: category.image,
    };
  });

  if (result.image) {
    await deleteShopCategoryImageFile(result.image);
  }

  return {
    id: result.id,
    name: result.name,
  };
};

// ==========================================
// GET SINGLE ADMIN ACTIVITY LOG
// ==========================================

export const getAdminActivityLogById = async (
  logId,
  actorId
) => {
  const id = validateId(logId, "Activity Log ID");

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(
      tx,
      actorId,
      "VIEW_ACTIVITY_LOGS"
    );

    const activityLog = await tx.adminActivityLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!activityLog) {
      throw createError("Activity log not found.", 404);
    }

    return formatActivityLog(activityLog);
  });
};
