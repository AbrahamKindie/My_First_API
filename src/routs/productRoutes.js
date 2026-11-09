
import express from "express";

import authenticate from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import validate from "../middleware/validateMiddleware.js";

import {
  createProductSchema,
  updateProductSchema,
  setProductFeaturedSchema,
  setProductDiscountSchema,
} from "../validators/productValidation.js";

import {
  createProductController,
  getAllProductsController,
  getProductByIdController,
  updateProductController,
  deleteProductController,
  getFeaturedProductsController,
  getBestSellingProductsController,
  getNewArrivalsController,
  setProductFeaturedController,
  setProductDiscountController,
  removeProductDiscountController,
} from "../controllers/productControllers.js";

const router = express.Router();

// ============================================
// PUBLIC / AUTHENTICATED PRODUCT DISCOVERY
// ============================================

// Keep the authentication behavior from your existing routes.
router.get("/", authenticate, getAllProductsController);
router.get("/featured", authenticate, getFeaturedProductsController);
router.get("/best-selling", authenticate, getBestSellingProductsController);
router.get("/new-arrivals", authenticate, getNewArrivalsController);

// ============================================
// ADMIN PRODUCT MANAGEMENT
// ============================================

// Admin only
router.post("/", authenticate, requireAdmin, validate(createProductSchema), createProductController);
router.patch("/:id/featured", authenticate, requireAdmin, validate(setProductFeaturedSchema), setProductFeaturedController);
router.patch("/:id/discount", authenticate, requireAdmin, validate(setProductDiscountSchema), setProductDiscountController);
router.delete("/:id/discount", authenticate, requireAdmin, removeProductDiscountController);
router.patch("/:id", authenticate, requireAdmin, validate(updateProductSchema), updateProductController);
router.delete("/:id", authenticate, requireAdmin, deleteProductController);

// ============================================
// PRODUCT DETAILS
// ============================================

router.get("/:id", authenticate, getProductByIdController);

export default router;
