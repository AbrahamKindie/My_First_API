
import express from "express";

import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
} from "../controllers/cartControllers.js";
import authenticate from "../middleware/auth.js";
import validate from "../middleware/validateMiddleware.js";
import {   addToCartSchema, updateCartItemSchema, removeCartItemSchema, clearCartSchema,} from "../validators/cartValidations.js";

// Import and apply your existing authentication middleware
// All cart endpoints must be authenticated.

const router = express.Router();

router.get("/", authenticate, getCartController);

router.post("/items", authenticate, validate(addToCartSchema), addToCartController);

router.patch("/items/:id", authenticate, validate(updateCartItemSchema), updateCartItemController);

router.delete("/items/:id", authenticate, validate(removeCartItemController), removeCartItemController);

router.delete("/items", authenticate, validate(clearCartSchema), clearCartController);

export default router;
