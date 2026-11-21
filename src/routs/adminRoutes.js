
import express from "express";

import auth from "../middleware/auth.js";
import validate from "../middleware/validateMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import uploadShopCategoryImage from "../middleware/uploadShopCategoryImage.js";

import {
  createAdminSchema,
  adminIdSchema,
  updateAdminSchema,
  updateAdminStatusSchema,
  adminActivityLogsSchema,
  marketplaceUsersSchema,
  updateMarketplaceUserStatusSchema,
  shopManagementSchema,
  updateShopStatusSchema,
  createShopCategorySchema,
  updateShopCategorySchema,
  shopCategoryIdSchema,
} from "../validators/adminValidations.js";

import {
  createAdminController,
  resendAdminPasswordSetupEmailController,
  updateAdminController,
  updateAdminStatusController,
  deleteAdminController,
  getAllAdminsController,
  getAdminActivityLogsController,
  getAdminActivityLogByIdController,
  getAdminDashboardStatsController,
  getMarketplaceUsersController,
  updateMarketplaceUserStatusController,
  getAllShopsController,
  getShopByIdController,
  updateShopStatusController,
  createShopCategoryController,
  updateShopCategoryController,
  deleteShopCategoryController,
} from "../controllers/adminControllers.js";

const router = express.Router();

// ==========================================
// ADMIN MANAGEMENT
// ==========================================

// CREATE ADMIN
router.post(
  "/",
  auth,
  validate(createAdminSchema),
  requirePermission("CREATE_ADMINS"),
  createAdminController
);

// GET ALL ADMINS
router.get(
  "/",
  auth,
  requirePermission("VIEW_ADMINS"),
  getAllAdminsController
);

// UPDATE ADMIN PROFILE
router.patch(
  "/:adminId",
  auth,
  validate(updateAdminSchema),
  requirePermission("UPDATE_ADMINS"),
  updateAdminController
);

// RESEND FIRST-TIME PASSWORD SETUP EMAIL
router.post(
  "/:adminId/resend-password-setup",
  auth,
  validate(adminIdSchema),
  requirePermission("RESEND_ADMIN_SETUP_EMAIL"),
  resendAdminPasswordSetupEmailController
);

// ACTIVATE / DEACTIVATE ADMIN
router.patch(
  "/:adminId/status",
  auth,
  validate(updateAdminStatusSchema),
  requirePermission((req) =>
    req.body.isActive
      ? "ACTIVATE_ADMINS"
      : "DEACTIVATE_ADMINS"
  ),
  updateAdminStatusController
);

// PERMANENTLY DELETE ADMIN
router.delete(
  "/:adminId",
  auth,
  validate(adminIdSchema),
  requirePermission("DELETE_ADMINS"),
  deleteAdminController
);

// ==========================================
// ADMIN ACTIVITY LOGS
// ==========================================

// GET ALL ADMIN ACTIVITY LOGS
router.get(
  "/activity-logs",
  auth,
  validate(adminActivityLogsSchema),
  requirePermission("VIEW_ACTIVITY_LOGS"),
  getAdminActivityLogsController
);

// GET SINGLE ADMIN ACTIVITY LOG
router.get(
  "/activity-logs/:logId",
  auth,
  requirePermission("VIEW_ACTIVITY_LOGS"),
  getAdminActivityLogByIdController
);

// ==========================================
// ADMIN DASHBOARD
// ==========================================

router.get(
  "/dashboard",
  auth,
  requirePermission("VIEW_REPORTS"),
  getAdminDashboardStatsController
);

// ==========================================
// MARKETPLACE USER MANAGEMENT
// ==========================================

// GET MARKETPLACE USERS
router.get(
  "/users",
  auth,
  validate(marketplaceUsersSchema),
  requirePermission("VIEW_USERS"),
  getMarketplaceUsersController
);

// ACTIVATE / DEACTIVATE MARKETPLACE USER
router.patch(
  "/users/:userId/status",
  auth,
  validate(updateMarketplaceUserStatusSchema),
  requirePermission((req) =>
    req.body.isActive
      ? "ACTIVATE_USERS"
      : "DEACTIVATE_USERS"
  ),
  updateMarketplaceUserStatusController
);

// ==========================================
// SHOP CATEGORY MANAGEMENT
// ==========================================

// CREATE SHOP CATEGORY
router.post(
  "/categories",
  auth,
  requirePermission("CREATE_CATEGORIES"),
  uploadShopCategoryImage.single("image"),
  validate(createShopCategorySchema),
  createShopCategoryController
);

// UPDATE SHOP CATEGORY
router.patch(
  "/categories/:categoryId",
  auth,
  requirePermission("UPDATE_CATEGORIES"),
  uploadShopCategoryImage.single("image"),
  validate(updateShopCategorySchema),
  updateShopCategoryController
);

// DELETE SHOP CATEGORY
router.delete(
  "/categories/:categoryId",
  auth,
  validate(shopCategoryIdSchema),
  requirePermission("DELETE_CATEGORIES"),
  deleteShopCategoryController
);

// ==========================================
// SHOP MANAGEMENT
// ==========================================

// GET ALL SHOPS
router.get(
  "/shops",
  auth,
  validate(shopManagementSchema),
  requirePermission("VIEW_SHOPS"),
  getAllShopsController
);

// GET SHOP DETAILS
router.get(
  "/shops/:shopId",
  auth,
  requirePermission("VIEW_SHOPS"),
  getShopByIdController
);

// ACTIVATE / DEACTIVATE SHOP
router.patch(
  "/shops/:shopId/status",
  auth,
  validate(updateShopStatusSchema),
  requirePermission((req) =>
    req.body.status === "ACTIVE"
      ? "ACTIVATE_SHOPS"
      : "DEACTIVATE_SHOPS"
  ),
  updateShopStatusController
);

export default router;
