import  express  from "express";
import authenticate from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import validate from "../middleware/validateMiddleware.js";
import { createProductSchema, updateProductSchema } from "../validators/productValidation.js";

import {
  createProductController,
  getAllProductsController,
  getProductByIdController,
  updateProductController,
  deleteProductController,
} from "../controllers/productControllers.js";

const router = express.Router();

// Admin only
router.post("/", authenticate, requireAdmin,validate(createProductSchema), createProductController);
router.patch("/:id", authenticate, requireAdmin,validate(updateProductSchema), updateProductController);
router.delete("/:id", authenticate, requireAdmin, deleteProductController);

// Authenticated users and admins
router.get("/", authenticate, getAllProductsController);
router.get("/:id", authenticate, getProductByIdController);

export default router;