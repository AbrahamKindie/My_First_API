
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
  deleteReviewController,
} from "../controllers/reviewControllers.js";

const router = Router();

// Product reviews
router.get("/product/:productId", authenticate, getProductReviewsController);
router.post("/product/:productId", authenticate, validate(createReviewSchema), createReviewController);

// Manage own reviews
router.patch("/:id", authenticate, validate(updateReviewSchema), updateReviewController);
router.delete("/:id", authenticate, deleteReviewController);

export default router;
