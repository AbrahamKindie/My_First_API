
import { Router } from "express";
import authenticate from "../middleware/auth.js";
import validate from "../middleware/validateMiddleware.js";

import {
  createReviewSchema,
  updateReviewSchema,
} from "../validators/reviewValidation.js";

import {
  createReviewController,
  getProductReviewsController,
  updateReviewController,
  getMyShopReviewsController,
} from "../controllers/reviewControllers.js";

import requireShopOwner from "../middleware/requireShopOwner.js";

const router = Router();

// Get product reviews (public)
router.get(
  "/product/:productId",
  getProductReviewsController
);

// Create review (authenticated users only)
router.post(
  "/product/:productId",
  authenticate,
  validate(createReviewSchema),
  createReviewController
);

// Update own review (authenticated users only)
router.patch(
  "/:id",
  authenticate,
  validate(updateReviewSchema),
  updateReviewController
);


 // Shop Owner - Get reviews for products in their shop
 // GET /reviews/my-shop
router.get(
  "/my-shop",
  authenticate,
  requireShopOwner,
  getMyShopReviewsController
);


export default router;
