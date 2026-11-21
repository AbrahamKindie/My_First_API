
import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import JWT from "jsonwebtoken";
import crypto from "crypto";
import transporter from "../utils/email.js";

// ==========================================
// REUSABLE HELPERS
// ==========================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw createError("JWT configuration is missing.", 500);
  }

  return process.env.JWT_SECRET;
};

const generateAccessToken = (user) =>
  JWT.sign(
    { userId: user.id },
    getJwtSecret(),
    { expiresIn: "1h" }
  );

const generateRefreshToken = () =>
  crypto.randomBytes(64).toString("hex");

const getRefreshTokenExpiry = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const normalizeOptionalString = (value) =>
  typeof value === "string" ? value.trim() || null : null;

const normalizeCategoryName = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";

// ==========================================
// DATABASE-DRIVEN ADMIN PERMISSIONS
// ==========================================

const getAdminPermissions = (user) => {
  if (user.role !== "ADMIN") {
    return [];
  }

  if (
    !user.adminRoleId ||
    !user.adminRole ||
    !user.adminRole.isActive ||
    user.adminRole.id !== user.adminRoleId
  ) {
    return [];
  }

  const permissions = user.adminRole.permissions || [];

  return [
    ...new Set(
      permissions
        .map((item) => item.permission?.key)
        .filter(
          (key) =>
            typeof key === "string" &&
            key.length > 0 &&
            key !== "MANAGE_ADMIN_PERMISSIONS"
        )
    ),
  ];
};

// ==========================================
// DATABASE-DRIVEN ADMIN ROLE INCLUDE
// ==========================================

const adminRoleInclude = {
  adminRole: {
    select: {
      id: true,
      name: true,
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

// ==========================================
// AUTHENTICATED USER INCLUDE
// ==========================================

const authenticatedUserInclude = {
  ...adminRoleInclude,

  shop: {
    include: {
      shopCategory: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  },
};

// ==========================================
// ADMIN AUTHORIZATION VALIDATION
// ==========================================

const validateAdminAccount = (user) => {
  if (user.role !== "ADMIN") {
    return;
  }

  if (
    !user.adminRoleId ||
    !user.adminRole ||
    user.adminRole.id !== user.adminRoleId
  ) {
    throw createError(
      "Your Admin account does not have an assigned role.",
      403
    );
  }

  if (!user.adminRole.isActive) {
    throw createError(
      "Your assigned Admin role is inactive.",
      403
    );
  }
};

// ==========================================
// SAFE USER RESPONSE
// ==========================================

const getSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  sort_order: user.sort_order,
  gender: user.gender,
  address: user.address,
  city: user.city,
  country: user.country,
  profileImage: user.profileImage,
  isVerified: user.isVerified,
  isActive: user.isActive,
  role: user.role,

  isSuperAdmin: user.role === "SUPER_ADMIN",

  adminPermissions: getAdminPermissions(user),

  adminRole:
    user.role === "ADMIN" && user.adminRole
      ? {
          id: user.adminRole.id,
          name: user.adminRole.name,
          isActive: user.adminRole.isActive,
        }
      : null,

  shop: user.shop || null,

  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ==========================================
// REGISTER BUYER OR SHOP OWNER
// ==========================================

export const registerUser = async (data) => {
  const {
    name,
    email,
    password,
    phone,
    dateOfBirth,
    gender,
    address,
    city,
    country,
    role = "USER",
    shop,
  } = data || {};

  // ========================================
  // VALIDATE REGISTRATION ROLE
  // ========================================

  if (!["USER", "SHOP_OWNER"].includes(role)) {
    throw createError(
      "Invalid registration role. Admin registration is not allowed.",
      403
    );
  }

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw createError("Name, email, and password are required.");
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone =
    typeof phone === "string" ? phone.trim() || null : null;

  if (!cleanName || !cleanEmail || !password) {
    throw createError("Name, email, and password are required.");
  }

  if (password.length < 8) {
    throw createError("Password must be at least 8 characters.");
  }

  if (
    !dateOfBirth ||
    typeof gender !== "string" ||
    !gender.trim()
  ) {
    throw createError("Date of birth and gender are required.");
  }

  // ========================================
  // VALIDATE SHOP OWNER INFORMATION
  // ========================================

  let validShopCategoryId = null;
  let customCategoryName = "";
  let customCategoryImage = "";

  if (role === "SHOP_OWNER") {
    if (
      !shop ||
      typeof shop !== "object" ||
      Array.isArray(shop)
    ) {
      throw createError("Shop information is required.");
    }

    if (
      typeof shop.name !== "string" ||
      !shop.name.trim() ||
      typeof shop.description !== "string" ||
      !shop.description.trim() ||
      typeof shop.phone !== "string" ||
      !shop.phone.trim()
    ) {
      throw createError(
        "Shop name, description, and contact phone are required."
      );
    }

    validShopCategoryId = Number(shop.shopCategoryId);

    if (
      !Number.isSafeInteger(validShopCategoryId) ||
      validShopCategoryId <= 0
    ) {
      throw createError("Please select a valid shop category.");
    }

    // IMPORTANT:
    // Both custom fields are inside data.shop.
    customCategoryName =
      typeof shop.customCategoryName === "string"
        ? shop.customCategoryName.trim().replace(/\s+/g, " ")
        : "";

    customCategoryImage =
      typeof shop.customCategoryImage === "string"
        ? shop.customCategoryImage.trim()
        : "";

    // Validate the custom image data URL.
    if (
      customCategoryImage &&
      !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(
        customCategoryImage
      )
    ) {
      throw createError(
        "Invalid custom category image format. Please upload a PNG, JPEG, or WebP image."
      );
    }

    // Both fields must be provided together.
    if (
      Boolean(customCategoryName) !==
      Boolean(customCategoryImage)
    ) {
      throw createError(
        "Custom category name and category image are both required."
      );
    }
  }

  // ========================================
  // VALIDATE DATE OF BIRTH
  // ========================================

  const parsedDateOfBirth = new Date(dateOfBirth);

  if (
    Number.isNaN(parsedDateOfBirth.getTime()) ||
    parsedDateOfBirth >= new Date()
  ) {
    throw createError("Invalid date of birth.");
  }

  // ========================================
  // CHECK EXISTING EMAIL
  // ========================================

  const existingUser = await prisma.user.findUnique({
    where: {
      email: cleanEmail,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw createError("Email is already registered.", 409);
  }

  // ========================================
  // CHECK EXISTING PERSONAL PHONE
  // ========================================

  if (cleanPhone) {
    const existingPhone = await prisma.user.findUnique({
      where: {
        phone: cleanPhone,
      },
      select: {
        id: true,
      },
    });

    if (existingPhone) {
      throw createError("Phone number already exists.", 409);
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    // ========================================
    // CREATE USER AND SHOP IN TRANSACTION
    // ========================================

    const createdUser = await prisma.$transaction(
      async (tx) => {
        let resolvedShopCategoryId = null;
        let isCustomCategory = false;

        if (role === "SHOP_OWNER") {
          // ======================================
          // FIND SELECTED CATEGORY
          // ======================================

          const selectedCategory =
            await tx.shopCategory.findUnique({
              where: {
                id: validShopCategoryId,
              },
              select: {
                id: true,
                name: true,
              },
            });

          if (!selectedCategory) {
            throw createError(
              "Selected shop category not found.",
              404
            );
          }

          const selectedCategoryName =
            normalizeCategoryName(selectedCategory.name);

          isCustomCategory = selectedCategoryName === "other";

          // ======================================
          // HANDLE OTHER CATEGORY
          // ======================================

          if (isCustomCategory) {
            if (!customCategoryName || !customCategoryImage) {
              throw createError(
                'Please enter a custom category name and upload its image when selecting "Other".'
              );
            }

            if (customCategoryName.length < 2) {
              throw createError(
                "Custom category name must be at least 2 characters."
              );
            }

            if (customCategoryName.length > 100) {
              throw createError(
                "Custom category name cannot exceed 100 characters."
              );
            }

            const normalizedName =
              normalizeCategoryName(customCategoryName);

            // ======================================
            // CHECK DUPLICATE CATEGORY
            // ======================================

            const existingCategories =
              await tx.shopCategory.findMany({
                select: {
                  id: true,
                  name: true,
                },
              });

            const duplicateCategory =
              existingCategories.find(
                (category) =>
                  normalizeCategoryName(category.name) ===
                  normalizedName
              );

            if (duplicateCategory) {
              throw createError(
                "This category already exists. Please select it from the category list.",
                409
              );
            }

            // ======================================
            // CREATE CUSTOM CATEGORY
            // ======================================

            const newCategory =
              await tx.shopCategory.create({
                data: {
                  name: customCategoryName,
                  image: customCategoryImage,
                },
                select: {
                  id: true,
                },
              });

            resolvedShopCategoryId = newCategory.id;

          } else {
            // ======================================
            // USE EXISTING CATEGORY
            // ======================================

            if (customCategoryName || customCategoryImage) {
              throw createError(
                'Custom category details are only allowed when selecting "Other".'
              );
            }

            resolvedShopCategoryId = selectedCategory.id;
          }
        }

        // ========================================
        // GENERATE USER SORT ORDER
        // ========================================

        const lastUser = await tx.user.findFirst({
          orderBy: {
            sort_order: "desc",
          },
          select: {
            sort_order: true,
          },
        });

        const nextSortOrder = lastUser
          ? lastUser.sort_order + 1
          : 1;

        const userData = {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          sort_order: nextSortOrder,
          phone: cleanPhone,
          dateOfBirth: parsedDateOfBirth,
          gender: gender.trim(),
          address: normalizeOptionalString(address),
          city: normalizeOptionalString(city),
          country: normalizeOptionalString(country),
          role,
        };

        // ========================================
        // BUYER REGISTRATION
        // ========================================

        if (role === "USER") {
          return tx.user.create({
            data: userData,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              dateOfBirth: true,
              gender: true,
              role: true,
              sort_order: true,
              address: true,
              city: true,
              country: true,
              isActive: true,
              createdAt: true,
            },
          });
        }

        // ========================================
        // SHOP OWNER REGISTRATION
        // ========================================

        return tx.user.create({
          data: {
            ...userData,

            shop: {
              create: {
                name: shop.name.trim(),
                description: shop.description.trim(),

                shopCategory: {
                  connect: {
                    id: resolvedShopCategoryId,
                  },
                },

                phone: shop.phone.trim(),
                logo: normalizeOptionalString(shop.logo),
                email: normalizeOptionalString(shop.email),
                address: normalizeOptionalString(shop.address),
                city: normalizeOptionalString(shop.city),
                region: normalizeOptionalString(shop.region),

                status: "ACTIVE",
              },
            },
          },

          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            dateOfBirth: true,
            gender: true,
            role: true,
            sort_order: true,
            isActive: true,
            createdAt: true,

            shop: {
              select: {
                id: true,
                name: true,
                description: true,
                shopCategoryId: true,

                shopCategory: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    image: true,
                  },
                },

                logo: true,
                phone: true,
                email: true,
                address: true,
                city: true,
                region: true,
                status: true,
                createdAt: true,
              },
            },
          },
        });
      }
    );

    // ========================================
    // SHOP OWNER RESPONSE
    // ========================================

    if (role === "SHOP_OWNER") {
      return {
        message: customCategoryName && customCategoryImage
          ? "Shop Owner registration successful. Your custom shop category has been created."
          : "Shop Owner registration successful.",

        registrationType: "SHOP_OWNER",
        nextStep: "LOGIN",
        user: createdUser,
        //shop: createdUser.shop,
      };
    }

    // ========================================
    // BUYER RESPONSE
    // ========================================

    return {
      message: "Buyer registration successful.",
      registrationType: "BUYER",
      nextStep: "LOGIN",
      user: createdUser,
    };

  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "Email, phone number, or category already exists. Please try again.",
        409
      );
    }

    if (error.code === "P2003") {
      throw createError(
        "Invalid shop category selected.",
        400
      );
    }

    throw error;
  }
};

// ==========================================
// LOGIN
// ==========================================

export const loginUser = async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    throw createError("Email and password are required.");
  }

  const cleanEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: cleanEmail,
    },
    include: authenticatedUserInclude,
  });

  if (!user) {
    throw createError("Invalid email or password.", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createError("Invalid email or password.", 401);
  }

  if (!user.isActive) {
    throw createError("Your account is inactive.", 403);
  }

  if (
    user.role === "ADMIN" &&
    user.adminPasswordSetupCompleted === false
  ) {
    throw createError(
      "Please complete your Admin password setup before logging in.",
      403
    );
  }

  validateAdminAccount(user);

  const token = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      refreshToken: hashToken(refreshToken),
      refreshTokenExpiry: getRefreshTokenExpiry(),
    },
  });

  return {
    token,
    refreshToken,
    user: getSafeUser(user),
  };
};

// ==========================================
// REFRESH ACCESS TOKEN
// ==========================================

export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken || typeof refreshToken !== "string") {
    throw createError("Refresh token is required.", 401);
  }

  const hashedToken = hashToken(refreshToken);
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      refreshToken: hashedToken,
      refreshTokenExpiry: {
        gt: now,
      },
    },

    include: authenticatedUserInclude,
  });

  if (!user) {
    throw createError("Invalid or expired refresh token.", 401);
  }

  if (!user.isActive) {
    throw createError("Your account is inactive.", 403);
  }

  if (
    user.role === "ADMIN" &&
    user.adminPasswordSetupCompleted === false
  ) {
    throw createError(
      "Please complete your Admin password setup before logging in.",
      403
    );
  }

  validateAdminAccount(user);

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken();

  const newRefreshTokenExpiry = getRefreshTokenExpiry();

  const updated = await prisma.user.updateMany({
    where: {
      id: user.id,
      refreshToken: hashedToken,
      refreshTokenExpiry: {
        gt: now,
      },
    },

    data: {
      refreshToken: hashToken(newRefreshToken),
      refreshTokenExpiry: newRefreshTokenExpiry,
    },
  });

  if (updated.count !== 1) {
    throw createError(
      "Refresh token has already been used or is invalid.",
      401
    );
  }

  return {
    token: newAccessToken,
    refreshToken: newRefreshToken,
    user: getSafeUser(user),
  };
};

// ==========================================
// CHANGE PASSWORD
// ==========================================

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};

  if (
    typeof oldPassword !== "string" ||
    typeof newPassword !== "string" ||
    !oldPassword ||
    !newPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Old password and new password are required.",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters long.",
    });
  }

  try {
    const userId = Number(req.user?.userId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(
      oldPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid old password.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        password: hashedPassword,
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully. Please log in again on your other devices.",
    });

  } catch (error) {
    console.error("Error changing password:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Internal server error.",
    });
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================

export const forgotPasswordUser = async (req, res) => {
  const responseMessage =
    "If the email is registered, a password reset link has been sent.";

  try {
    const { email } = req.body || {};

    if (
      !email ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!process.env.FRONTEND_URL) {
      throw new Error("FRONTEND_URL is missing.");
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const resetTokenExpiry = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        resetPasswordToken: hashToken(resetToken),
        resetPasswordExpires: resetTokenExpiry,
      },
    });

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Reset Your ShopEase Password",

        text: `Click this link to reset your password: ${resetLink}`,

        html: `
          <h2>Reset Your ShopEase Password</h2>
          <p>You requested a password reset.</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>This link expires in 15 minutes.</p>
          <p>If you did not request this, ignore this email.</p>
        `,
      });

    } catch (emailError) {
      console.error("Password reset email failed:", emailError);

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });

  } catch (error) {
    console.error("Error in forgot password:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request.",
    });
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================

export const resetPasswordUser = async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide a valid reset token and a password with at least 8 characters.",
    });
  }

  try {
    const now = new Date();
    const hashedResetToken = hashToken(token.trim());
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updated = await prisma.user.updateMany({
      where: {
        resetPasswordToken: hashedResetToken,
        resetPasswordExpires: {
          gt: now,
        },
      },

      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });

    if (updated.count !== 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. Please log in with your new password.",
    });

  } catch (error) {
    console.error("Error in reset password:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password.",
    });
  }
};

// ==========================================
// VERIFY ADMIN PASSWORD SETUP TOKEN
// ==========================================

export const verifyAdminPasswordSetup = async (token) => {
  if (typeof token !== "string" || !token.trim()) {
    throw createError(
      "Admin password setup token is required.",
      400
    );
  }

  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
      adminPasswordSetupCompleted: false,

      adminPasswordSetupToken: hashToken(token.trim()),

      adminPasswordSetupExpires: {
        gt: new Date(),
      },
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminPasswordSetupCompleted: true,
    },
  });

  if (!admin) {
    throw createError(
      "Invalid or expired Admin password setup link.",
      400
    );
  }

  return {
    valid: true,

    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
    },
  };
};

// ==========================================
// COMPLETE ADMIN PASSWORD SETUP
// ==========================================

export const setupAdminPassword = async (
  token,
  newPassword,
  confirmPassword
) => {
  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    throw createError(
      "Setup token, new password, and confirmation password are required.",
      400
    );
  }

  if (newPassword.length < 8) {
    throw createError(
      "Password must be at least 8 characters long.",
      400
    );
  }

  if (newPassword !== confirmPassword) {
    throw createError(
      "Password and confirmation password do not match.",
      400
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const hashedSetupToken = hashToken(token.trim());
  const now = new Date();

  const updated = await prisma.user.updateMany({
    where: {
      role: "ADMIN",
      isActive: true,
      adminPasswordSetupCompleted: false,

      adminPasswordSetupToken: hashedSetupToken,

      adminPasswordSetupExpires: {
        gt: now,
      },
    },

    data: {
      password: hashedPassword,
      adminPasswordSetupToken: null,
      adminPasswordSetupExpires: null,
      adminPasswordSetupCompleted: true,

      refreshToken: null,
      refreshTokenExpiry: null,
    },
  });

  if (updated.count !== 1) {
    throw createError(
      "Invalid, expired, or already used Admin password setup link.",
      400
    );
  }

  return {
    message:
      "Admin password setup completed successfully. You can now log in.",
  };
};

// ==========================================
// LOGOUT
// ==========================================

export const logoutUser = async (refreshToken) => {
  if (
    !refreshToken ||
    typeof refreshToken !== "string"
  ) {
    throw createError("Refresh token is required.", 400);
  }

  const hashedToken = hashToken(refreshToken);

  const user = await prisma.user.findFirst({
    where: {
      refreshToken: hashedToken,
    },

    select: {
      id: true,
    },
  });

  if (!user) {
    throw createError("Invalid refresh token.", 401);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      refreshToken: null,
      refreshTokenExpiry: null,
    },
  });

  return true;
};
