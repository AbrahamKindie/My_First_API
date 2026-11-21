
import express from "express";

// ==========================================
// PUBLIC SHOP CATEGORY CONTROLLERS
// ==========================================
import {
  getAllCategoriesController,
  getCategoryByIdController,
} from "../controllers/categoryControllers.js";

// ==========================================
// SHOP OWNER PRODUCT CATEGORY CONTROLLERS
// ==========================================

import {
  getMyProductCategoriesController as getMyShopCategoriesController,
  getProductCategoryByIdController as getMyShopCategoryByIdController,
  createProductCategoryController as createMyShopCategoryController,
  updateProductCategoryController as updateMyShopCategoryController,
  deleteProductCategoryController as deleteMyShopCategoryController,
} from "../controllers/productCategoryControllers.js";

// ==========================================
// MIDDLEWARE
// ==========================================

import authentication  from "../middleware/auth.js";
import requireShopOwner from "../middleware/requireShopOwner.js";

const router = express.Router();

// ==========================================
// SHOP OWNER PRODUCT CATEGORY MANAGEMENT
// ==========================================

// Get all product categories belonging to the authenticated shop.
router.get(
  "/my-shop",
  authentication,
  requireShopOwner,
  getMyShopCategoriesController
);

// Get one product category belonging to the authenticated shop.
router.get(
  "/my-shop/:id",
  authentication,
  requireShopOwner,
  getMyShopCategoryByIdController
);

// Create a product category for the authenticated shop.
router.post(
  "/my-shop",
  authentication,
  requireShopOwner,
  createMyShopCategoryController
);

// Update a product category belonging to the authenticated shop.
router.patch(
  "/my-shop/:id",
  authentication,
  requireShopOwner,
  updateMyShopCategoryController
);

// Delete a product category belonging to the authenticated shop.
router.delete(
  "/my-shop/:id",
  authentication,
  requireShopOwner,
  deleteMyShopCategoryController
);

// ==========================================
// PUBLIC SHOP CATEGORY MANAGEMENT
// ==========================================

// Get all active shop categories.
// Used by customers and during shop registration.
router.get(
  "/",
  getAllCategoriesController
);

// Get one shop category.
router.get(
  "/:id",
  getCategoryByIdController
);

export default router;
