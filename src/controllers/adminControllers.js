
import {
  // ADMIN MANAGEMENT
  createAdmin,
  resendAdminPasswordSetupEmail,
  updateAdmin,
  updateAdminStatus,
  deleteAdmin,
  getAllAdmins,
  getAdminActivityLogs,
  getAdminActivityLogById,
  getAdminDashboardStats,

  // MARKETPLACE USER MANAGEMENT
  getMarketplaceUsers,
  updateMarketplaceUserStatus,

  // SHOP MANAGEMENT
  getAllShops,
  getShopById,
  updateShopStatus,

  // SHOP CATEGORY MANAGEMENT
  createShopCategory,
  updateShopCategory,
  deleteShopCategory,
} from "../services/adminServices.js";

import { unlink } from "node:fs/promises";
import path from "node:path";

// ==========================================
// REUSABLE ERROR HANDLER
// ==========================================

const handleAdminError = (res, error, context) => {
  console.error(`[${context}]`, error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode
      ? error.message
      : "An unexpected error occurred while processing the Admin request.",
  });
};

// ==========================================
// CATEGORY IMAGE CLEANUP
// ONLY DELETE FILES FROM CATEGORY UPLOADS
// ==========================================

const cleanupUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    const uploadDirectory = path.resolve(
      process.cwd(),
      "uploads",
      "categories"
    );

    const uploadedFilePath = path.resolve(file.path);
    const relativePath = path.relative(
      uploadDirectory,
      uploadedFilePath
    );

    // Prevent deletion outside the category upload directory.
    if (
      !relativePath ||
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      console.error(
        "[CATEGORY IMAGE CLEANUP BLOCKED] Invalid upload path."
      );
      return;
    }

    await unlink(uploadedFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "[CATEGORY IMAGE CLEANUP ERROR]",
        error
      );
    }
  }
};

// ==========================================
// ADMIN MANAGEMENT
// ==========================================

// CREATE ADMIN
export const createAdminController = async (req, res) => {
  try {
    const result = await createAdmin(
      req.body,
      req.user.userId
    );

    return res.status(201).json({
      success: true,
      message: result.message,
      setupEmailSent: result.setupEmailSent,
      admin: result.admin,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "CREATE ADMIN ERROR"
    );
  }
};

// RESEND ADMIN PASSWORD SETUP EMAIL
export const resendAdminPasswordSetupEmailController = async (
  req,
  res
) => {
  try {
    const result = await resendAdminPasswordSetupEmail(
      req.params.adminId,
      req.user.userId
    );

    return res.status(result.success ? 200 : 502).json({
      success: result.success,
      message: result.message,
      setupEmailSent: result.setupEmailSent,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "RESEND ADMIN PASSWORD SETUP EMAIL ERROR"
    );
  }
};

// UPDATE ADMIN PROFILE
export const updateAdminController = async (req, res) => {
  try {
    const admin = await updateAdmin(
      req.params.adminId,
      req.body,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Admin profile updated successfully.",
      admin,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "UPDATE ADMIN ERROR"
    );
  }
};

// ACTIVATE / DEACTIVATE ADMIN
export const updateAdminStatusController = async (req, res) => {
  try {
    const admin = await updateAdminStatus(
      req.params.adminId,
      req.body.isActive,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Admin account activated successfully."
        : "Admin account deactivated successfully.",
      admin,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "UPDATE ADMIN STATUS ERROR"
    );
  }
};

// PERMANENTLY DELETE ADMIN
export const deleteAdminController = async (req, res) => {
  try {
    const result = await deleteAdmin(
      req.params.adminId,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message:
        "Admin account permanently deleted. Activity history preserved.",
      deletedAdmin: result,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "DELETE ADMIN ERROR"
    );
  }
};

// GET ALL ADMINS
export const getAllAdminsController = async (req, res) => {
  try {
    const admins = await getAllAdmins(req.user.userId);

    return res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET ALL ADMINS ERROR"
    );
  }
};

// ==========================================
// ADMIN ACTIVITY LOGS
// ==========================================

// GET ADMIN ACTIVITY LOGS
export const getAdminActivityLogsController = async (
  req,
  res
) => {
  try {
    const result = await getAdminActivityLogs(
      req.user.userId,
      req.validatedQuery || req.query
    );

    return res.status(200).json({
      success: true,
      message: "Admin activity logs retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET ADMIN ACTIVITY LOGS ERROR"
    );
  }
};

// GET SINGLE ADMIN ACTIVITY LOG
export const getAdminActivityLogByIdController = async (
  req,
  res
) => {
  try {
    const log = await getAdminActivityLogById(
      req.params.logId,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Activity log retrieved successfully.",
      data: log,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET ADMIN ACTIVITY LOG BY ID ERROR"
    );
  }
};

// ==========================================
// ADMIN DASHBOARD
// ==========================================

export const getAdminDashboardStatsController = async (
  req,
  res
) => {
  try {
    const stats = await getAdminDashboardStats(
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message:
        "Admin dashboard statistics retrieved successfully.",
      data: stats,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET ADMIN DASHBOARD STATS ERROR"
    );
  }
};

// ==========================================
// MARKETPLACE USER MANAGEMENT
// ==========================================

// GET MARKETPLACE USERS
export const getMarketplaceUsersController = async (
  req,
  res
) => {
  try {
    const result = await getMarketplaceUsers(
      req.validatedQuery || req.query,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Marketplace users retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET MARKETPLACE USERS ERROR"
    );
  }
};

// ACTIVATE / DEACTIVATE MARKETPLACE USER
export const updateMarketplaceUserStatusController = async (
  req,
  res
) => {
  try {
    const user = await updateMarketplaceUserStatus(
      req.params.userId,
      req.body.isActive,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: req.body.isActive
        ? "Marketplace user activated successfully."
        : "Marketplace user deactivated successfully.",
      user,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "UPDATE MARKETPLACE USER STATUS ERROR"
    );
  }
};

// ==========================================
// SHOP MANAGEMENT
// ==========================================

// GET ALL SHOPS
export const getAllShopsController = async (req, res) => {
  try {
    const result = await getAllShops(
      req.validatedQuery || req.query,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Shops retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET ALL SHOPS ERROR"
    );
  }
};

// GET SHOP DETAILS
export const getShopByIdController = async (req, res) => {
  try {
    const shop = await getShopById(
      req.params.shopId,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Shop details retrieved successfully.",
      shop,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "GET SHOP DETAILS ERROR"
    );
  }
};

// ACTIVATE / DEACTIVATE SHOP
export const updateShopStatusController = async (req, res) => {
  try {
    const shop = await updateShopStatus(
      req.params.shopId,
      req.body.status,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message:
        shop.status === "ACTIVE"
          ? "Shop activated successfully."
          : "Shop deactivated successfully.",
      shop,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "UPDATE SHOP STATUS ERROR"
    );
  }
};

// ==========================================
// SHOP CATEGORY MANAGEMENT
// ==========================================

// CREATE SHOP CATEGORY
export const createShopCategoryController = async (
  req,
  res
) => {
  try {
    const category = await createShopCategory(
      {
        ...req.body,
        ...(req.file && {
          image: `/uploads/categories/${req.file.filename}`,
        }),
      },
      req.user.userId
    );

    return res.status(201).json({
      success: true,
      message: "Shop category created successfully.",
      category,
    });
  } catch (error) {
    await cleanupUploadedFile(req.file);

    return handleAdminError(
      res,
      error,
      "CREATE SHOP CATEGORY ERROR"
    );
  }
};

// UPDATE SHOP CATEGORY
export const updateShopCategoryController = async (
  req,
  res
) => {
  try {
    const category = await updateShopCategory(
      req.params.categoryId,
      {
        ...req.body,
        ...(req.file && {
          image: `/uploads/categories/${req.file.filename}`,
        }),
      },
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Shop category updated successfully.",
      category,
    });
  } catch (error) {
    await cleanupUploadedFile(req.file);

    return handleAdminError(
      res,
      error,
      "UPDATE SHOP CATEGORY ERROR"
    );
  }
};

// DELETE SHOP CATEGORY
export const deleteShopCategoryController = async (
  req,
  res
) => {
  try {
    const deletedCategory = await deleteShopCategory(
      req.params.categoryId,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Shop category deleted successfully.",
      deletedCategory,
    });
  } catch (error) {
    return handleAdminError(
      res,
      error,
      "DELETE SHOP CATEGORY ERROR"
    );
  }
};
