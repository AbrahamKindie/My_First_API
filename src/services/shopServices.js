
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ============================================
// SHOP PROFILE SELECT
// ============================================

const shopProfileSelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  shopCategoryId: true,
  shopCategory: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  logo: true,
  coverImage: true,
  address: true,
  city: true,
  region: true,
  phone: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

// ============================================
// ALLOWED PROFILE FIELDS
// Image fields use the dedicated upload endpoint.
// ============================================

const allowedProfileFields = [
  "name",
  "description",
  "shopCategoryId",
  "address",
  "city",
  "region",
  "phone",
  "email",
];

// ============================================
// VALIDATE SHOP OWNER ID
// ============================================

const validateOwnerId = (ownerId) => {
  const id = Number(ownerId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid account ID.", 400);
  }

  return id;
};

// ============================================
// VALIDATE SHOP IMAGE PATH
// ============================================


const validateShopImagePath = (imagePath, field) => {
  const directory =
    field === "logo"
      ? "/uploads/shops/logos/"
      : "/uploads/shops/covers/";

  if (
    typeof imagePath !== "string" ||
    !imagePath.startsWith(directory)
  ) {
    throw createError(`Invalid ${field} image.`, 400);
  }

  const filename = imagePath.slice(directory.length);

  // Validate UUID filename and image extension.
  const validFilename =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/i;

  if (!validFilename.test(filename)) {
    throw createError(`Invalid ${field} image path.`, 400);
  }

  return imagePath;
};


// ============================================
// GET ACTIVE SHOP
// ============================================

const getActiveShop = async (ownerId) => {
  const shop = await prisma.shop.findUnique({
    where: { ownerId },
    select: {
      id: true,
      ownerId: true,
      status: true,
    },
  });

  if (!shop) {
    throw createError(
      "You do not have a registered shop.",
      404
    );
  }

  if (shop.status !== "ACTIVE") {
    throw createError(
      "Your shop is deactivated.",
      403
    );
  }

  return shop;
};

// ============================================
// NORMALIZE PROFILE DATA
// ============================================

const normalizeProfileData = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Invalid shop profile information.",
      400
    );
  }

  const normalized = {};

  for (const field of allowedProfileFields) {
    if (data[field] === undefined) {
      continue;
    }

    if (field === "shopCategoryId") {
      const categoryId = Number(data[field]);

      if (
        !Number.isSafeInteger(categoryId) ||
        categoryId <= 0
      ) {
        throw createError(
          "Invalid shop category.",
          400
        );
      }

      normalized[field] = categoryId;
      continue;
    }

    if (
      data[field] !== null &&
      typeof data[field] !== "string"
    ) {
      throw createError(
        `Invalid value provided for ${field}.`,
        400
      );
    }

    let value =
      typeof data[field] === "string"
        ? data[field].trim()
        : null;

    if (field === "email" && value) {
      value = value.toLowerCase();
    }

    if (
      ["name", "phone", "description"].includes(field) &&
      !value
    ) {
      throw createError(
        `${field.charAt(0).toUpperCase() + field.slice(1)} cannot be empty.`,
        400
      );
    }

    normalized[field] = value;
  }

  return normalized;
};

// ============================================
// GET MY SHOP PROFILE
// ============================================


export const getMyShopProfile = async (ownerId) => {
  const id = validateOwnerId(ownerId);

  await getActiveShop(id);

  // Fetch shop profile and categories together.
  const [shop, categories] = await Promise.all([
    prisma.shop.findUnique({
      where: { ownerId: id },
      select: shopProfileSelect,
    }),

    prisma.shopCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!shop) {
    throw createError(
      "You do not have a registered shop.",
      404
    );
  }

  // Exclude the "Other" category.
  const availableCategories = categories.filter(
    (category) =>
      category.name?.trim().toLowerCase() !== "other"
  );

  return {
    success: true,
    message: "Shop profile and categories fetched successfully.",

    shop,

    categories: availableCategories,
  };
};


// ============================================
// UPDATE MY SHOP PROFILE
// ============================================

export const updateMyShopProfile = async (ownerId, data) => {
  const id = validateOwnerId(ownerId);

  const existingShop = await getActiveShop(id);

  const normalizedData = normalizeProfileData(data);

  if (Object.keys(normalizedData).length === 0) {
    throw createError(
      "No valid shop information was provided.",
      400
    );
  }

  // ==========================================
  // VALIDATE SHOP CATEGORY
  // ==========================================

  if (normalizedData.shopCategoryId !== undefined) {
    const category = await prisma.shopCategory.findUnique({
      where: {
        id: normalizedData.shopCategoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw createError(
        "The selected shop category does not exist.",
        404
      );
    }
  }

  // ==========================================
  // UPDATE PROFILE TRANSACTION
  // ==========================================

  try {
    const updatedShop = await prisma.$transaction(
      async (tx) => {
        const currentShop = await tx.shop.findFirst({
          where: {
            id: existingShop.id,
            ownerId: id,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

        if (!currentShop) {
          throw createError(
            "Your shop is deactivated.",
            403
          );
        }

        await tx.shop.update({
          where: {
            id: currentShop.id,
          },
          data: normalizedData,
        });

        return await tx.shop.findUnique({
          where: {
            id: currentShop.id,
          },
          select: shopProfileSelect,
        });
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return {
      success: true,
      message: "Shop profile updated successfully.",
      shop: updatedShop,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.code === "P2002") {
      throw createError(
        "The supplied shop information is already in use.",
        409
      );
    }

    if (error.code === "P2034") {
      throw createError(
        "Your shop profile was updated by another request. Please refresh and try again.",
        409
      );
    }

    throw error;
  }
};

// ============================================
// UPDATE SHOP LOGO AND COVER IMAGE
// ============================================

export const updateMyShopImages = async (ownerId, imageData) => {
  const id = validateOwnerId(ownerId);

  const existingShop = await getActiveShop(id);

  if (
    !imageData ||
    typeof imageData !== "object" ||
    Array.isArray(imageData)
  ) {
    throw createError(
      "Invalid shop image information.",
      400
    );
  }

  // ==========================================
  // VALIDATE ALLOWED IMAGE FIELDS
  // ==========================================

  const allowedFields = ["logo", "coverImage"];

  const unexpectedFields = Object.keys(imageData).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unexpectedFields.length > 0) {
    throw createError(
      "Invalid shop image fields.",
      400
    );
  }

  const updateData = {};

  if (imageData.logo !== undefined) {
    updateData.logo = validateShopImagePath(
      imageData.logo,
      "logo"
    );
  }

  if (imageData.coverImage !== undefined) {
    updateData.coverImage = validateShopImagePath(
      imageData.coverImage,
      "coverImage"
    );
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      "Please upload a logo or cover image.",
      400
    );
  }

  // ==========================================
  // UPDATE IMAGES TRANSACTION
  // ==========================================

  try {
    return await prisma.$transaction(
      async (tx) => {
        const currentShop = await tx.shop.findFirst({
          where: {
            id: existingShop.id,
            ownerId: id,
            status: "ACTIVE",
          },
          select: {
            id: true,
            logo: true,
            coverImage: true,
          },
        });

        if (!currentShop) {
          throw createError(
            "Your shop is deactivated.",
            403
          );
        }

        // Keep track of images that will be replaced.
        const oldImages = {};

        if (
          updateData.logo !== undefined &&
          currentShop.logo !== updateData.logo
        ) {
          oldImages.logo = currentShop.logo;
        }

        if (
          updateData.coverImage !== undefined &&
          currentShop.coverImage !== updateData.coverImage
        ) {
          oldImages.coverImage = currentShop.coverImage;
        }

        await tx.shop.update({
          where: {
            id: currentShop.id,
          },
          data: updateData,
        });

        const updatedShop = await tx.shop.findUnique({
          where: {
            id: currentShop.id,
          },
          select: shopProfileSelect,
        });

        return {
          shop: updatedShop,
          oldImages,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.code === "P2034") {
      throw createError(
        "Your shop images were updated by another request. Please try again.",
        409
      );
    }

    throw error;
  }
};
