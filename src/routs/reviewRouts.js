
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
} from "../controllers/reviewControllers.js";

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

export default router;
