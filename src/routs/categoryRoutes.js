import  express  from "express";
import authenticate from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import validate from "../middleware/validateMiddleware.js";
import { createCategorySchema, updateCategorySchema } from "../validators/categoryValidation.js";

import {
  createCategoryController,
  getAllCategoriesController,
  getCategoryByIdController,
  updateCategoryController,
  deleteCategoryController,
} from "../controllers/categoryControllers.js";

const router = express.Router();

// Admin only
router.post("/", authenticate, requireAdmin,validate(createCategorySchema), createCategoryController);
router.patch("/:id", authenticate, requireAdmin,validate(updateCategorySchema), updateCategoryController);
router.delete("/:id", authenticate, requireAdmin, deleteCategoryController);

// Authenticated users and admins
router.get("/", authenticate, getAllCategoriesController);
router.get("/:id", authenticate, getCategoryByIdController);

export default router;