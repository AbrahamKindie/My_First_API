
import express from "express";

import authenticate, {
  optionalAuthenticate,
} from "../middleware/auth.js";

import requireAdmin from "../middleware/requireAdmin.js";
import requirePermission from "../middleware/requirePermission.js";
import requireShopOwner from "../middleware/requireShopOwner.js";
import validate from "../middleware/validateMiddleware.js";
import uploadProductImages from "../middleware/uploadProductImages.js";

import {
  setProductStatusSchema,
  createShopProductSchema,
  updateShopProductSchema,
  setProductFeaturedSchema,
  setProductDiscountSchema,
  createProductReportSchema,
  reviewProductReportSchema,
  adminProductFiltersSchema,
} from "../validators/productValidation.js";

import {
  getAllProductsController,
  getProductsByShopCategoryController,
  getProductByIdController,
  getFeaturedProductsController,
  getBestSellingProductsController,
  getNewArrivalsController,
  setProductStatusController,
  likeProductController,
  unlikeProductController,
  getProductLikesController,
  getMyLikedProductsController,
  reportProductController,
  getMyProductReportsController,
  getAllProductReportsController,
  reviewProductReportController,
  getAdminProductsController,
  getAdminProductByIdController,
} from "../controllers/productControllers.js";

import {
  getMyShopProductsController,
  getMyShopProductByIdController,
  createShopProductController,
  updateShopProductController,
  deleteShopProductController,
  setShopProductFeaturedController,
  setShopProductDiscountController,
  removeShopProductDiscountController,
} from "../controllers/shopProductControllers.js";

const router = express.Router();

// ==========================================
// SHOP OWNER PRODUCT MANAGEMENT
// ==========================================

// Get all products belonging to the authenticated Shop Owner.
router.get(
  "/my-shop",
  authenticate,
  requireShopOwner,
  getMyShopProductsController
);

// Get one product belonging to the authenticated Shop Owner.
router.get(
  "/my-shop/:id",
  authenticate,
  requireShopOwner,
  getMyShopProductByIdController
);

// Create a product.
router.post(
  "/my-shop",
  authenticate,
  requireShopOwner,
  uploadProductImages.array("images", 10),
  validate(createShopProductSchema, {
    cleanupUploads: true,
  }),
  createShopProductController
);

// Update product details.
router.patch(
  "/my-shop/:id",
  authenticate,
  requireShopOwner,
  uploadProductImages.array("images", 10),
  validate(updateShopProductSchema, {
    cleanupUploads: true,
    requireUpdateData: true,
  }),
  updateShopProductController
);

// Permanently delete an eligible product belonging to the owner.
router.delete(
  "/my-shop/:id",
  authenticate,
  requireShopOwner,
  deleteShopProductController
);

// ==========================================
// SHOP OWNER FEATURED PRODUCT MANAGEMENT
// ==========================================

router.patch(
  "/my-shop/:id/featured",
  authenticate,
  requireShopOwner,
  validate(setProductFeaturedSchema),
  setShopProductFeaturedController
);

// ==========================================
// SHOP OWNER DISCOUNT MANAGEMENT
// ==========================================

router.put(
  "/my-shop/:id/discount",
  authenticate,
  requireShopOwner,
  validate(setProductDiscountSchema),
  setShopProductDiscountController
);

router.delete(
  "/my-shop/:id/discount",
  authenticate,
  requireShopOwner,
  removeShopProductDiscountController
);

// ==========================================
// PRODUCT LIKES
// ==========================================

router.get(
  "/my-likes",
  authenticate,
  getMyLikedProductsController
);

router.post(
  "/:id/like",
  authenticate,
  likeProductController
);

router.delete(
  "/:id/like",
  authenticate,
  unlikeProductController
);

router.get(
  "/:id/likes",
  optionalAuthenticate,
  getProductLikesController
);

// ==========================================
// PRODUCT REPORTS
// ==========================================

router.post(
  "/:id/reports",
  authenticate,
  validate(createProductReportSchema),
  reportProductController
);

router.get(
  "/my-reports",
  authenticate,
  getMyProductReportsController
);

router.get(
  "/reports",
  authenticate,
  requireAdmin,
  requirePermission("VIEW_PRODUCT_REPORTS"),
  getAllProductReportsController
);

router.patch(
  "/reports/:reportId",
  authenticate,
  requireAdmin,
  requirePermission("REVIEW_PRODUCT_REPORTS"),
  validate(reviewProductReportSchema),
  reviewProductReportController
);

// ==========================================
// PUBLIC PRODUCT DISCOVERY
// ==========================================

router.get(
  "/",
  getAllProductsController
);

router.get(
  "/shop-category/:categoryId",
  getProductsByShopCategoryController
);

// ==========================================
// ADMIN PRODUCT VIEWING
// ==========================================

router.get(
  "/admin",
  authenticate,
  requireAdmin,
  requirePermission("VIEW_PRODUCTS"),
  validate(adminProductFiltersSchema, {
    source: "query",
  }),
  getAdminProductsController
);

router.get(
  "/admin/:id",
  authenticate,
  requireAdmin,
  requirePermission("VIEW_PRODUCTS"),
  getAdminProductByIdController
);

// ==========================================
// PUBLIC PRODUCT COLLECTIONS
// ==========================================

router.get(
  "/featured",
  getFeaturedProductsController
);

router.get(
  "/best-selling",
  getBestSellingProductsController
);

router.get(
  "/new-arrivals",
  getNewArrivalsController
);

// ==========================================
// ADMIN PRODUCT ACTIVATION / DEACTIVATION
// ==========================================

router.patch(
  "/:id/status",
  authenticate,
  requireAdmin,
  validate(setProductStatusSchema),
  (req, res, next) => {
    if (req.body.status === "ADMIN_DEACTIVATED") {
      return requirePermission("DEACTIVATE_PRODUCTS")(
        req,
        res,
        next
      );
    }

    if (req.body.status === "ACTIVE") {
      return requirePermission("ACTIVATE_PRODUCTS")(
        req,
        res,
        next
      );
    }

    return res.status(400).json({
      success: false,
      message: "Invalid product status.",
    });
  },
  setProductStatusController
);

// ==========================================
// PUBLIC PRODUCT DETAILS
// ==========================================

router.get(
  "/:id",
  getProductByIdController
);

export default router;
