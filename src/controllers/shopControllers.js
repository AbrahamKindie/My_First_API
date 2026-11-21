
import fs from "node:fs/promises";
import path from "node:path";

import {
  getMyShopProfile,
  updateMyShopProfile,
  updateMyShopImages,
} from "../services/shopServices.js";

// ============================================
// UPLOADED SHOP IMAGE CLEANUP
// ============================================

const deleteShopImage = async (imagePath) => {
  if (typeof imagePath !== "string") return;

  const allowedDirectories = {
    logo: path.resolve(process.cwd(), "uploads", "shops", "logos"),
    coverImage: path.resolve(process.cwd(), "uploads", "shops", "covers"),
  };

  let directory;

  if (imagePath.startsWith("/uploads/shops/logos/")) {
    directory = allowedDirectories.logo;
  } else if (imagePath.startsWith("/uploads/shops/covers/")) {
    directory = allowedDirectories.coverImage;
  } else {
    return;
  }

  const filename = path.basename(imagePath);

  if (!filename || filename !== imagePath.split("/").pop()) {
    return;
  }

  try {
    await fs.unlink(path.join(directory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Shop image cleanup error:", error);
    }
  }
};

const cleanupUploadedShopImages = async (files = {}) => {
  const uploadedFiles = [
    ...(files.logo || []),
    ...(files.coverImage || []),
  ];

  await Promise.all(
    uploadedFiles.map((file) => {
      const imagePath = file.fieldname === "logo"
        ? `/uploads/shops/logos/${file.filename}`
        : `/uploads/shops/covers/${file.filename}`;

      return deleteShopImage(imagePath);
    })
  );
};

// ============================================
// GET MY SHOP PROFILE
// ============================================

export const getMyShopProfileController = async (req, res) => {
  try {
    const result = await getMyShopProfile(req.user.userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get my shop profile error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error.",
    });
  }
};

// ============================================
// UPDATE MY SHOP PROFILE
// ============================================

export const updateMyShopProfileController = async (req, res) => {
  try {
    const result = await updateMyShopProfile(
      req.user.userId,
      req.body
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Update my shop profile error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error.",
    });
  }
};

// ============================================
// UPDATE SHOP LOGO AND COVER IMAGE
// ============================================


export const updateMyShopImagesController = async (req, res) => {
  const logoFile = req.files?.logo?.[0];
  const coverFile = req.files?.coverImage?.[0];

  if (!logoFile && !coverFile) {
    await cleanupUploadedShopImages(req.files);

    return res.status(400).json({
      success: false,
      message: "Please upload a logo or cover image.",
    });
  }

  try {
    const imageData = {};

    if (logoFile) {
      imageData.logo = `/uploads/shops/logos/${logoFile.filename}`;
    }

    if (coverFile) {
      imageData.coverImage = `/uploads/shops/covers/${coverFile.filename}`;
    }

    const result = await updateMyShopImages(
      req.user.userId,
      imageData
    );

    // Database update succeeded. Clean up replaced images separately.
    if (result.oldImages) {
      await Promise.all([
        deleteShopImage(result.oldImages.logo),
        deleteShopImage(result.oldImages.coverImage),
      ]);
    }

    return res.status(200).json({
      success: true,
      message: "Shop images updated successfully.",
      shop: result.shop,
    });
  } catch (error) {
    // The service update failed, so remove newly uploaded files.
    await cleanupUploadedShopImages(req.files);

    console.error("Update shop images error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error.",
    });
  }
};

