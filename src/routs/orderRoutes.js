import { Router } from "express";
import {
  createOrderController,
  getAllOrdersController,
  getOrderByIdController,
  changeOrderStatusController,
  getMyOrdersController
} from "../controllers/orderControllers.js";
import authenticate from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import validate from "../middleware/validateMiddleware.js";
import { createOrderSchema, updateOrderStatusSchema } from "../validators/orderValidation.js";

const router = Router();

router.post("/", authenticate, validate(createOrderSchema), createOrderController);
router.get("/", authenticate, requireAdmin, getAllOrdersController);
router.get("/:id", authenticate, getOrderByIdController);
router.patch("/:id/status", authenticate, requireAdmin, validate(updateOrderStatusSchema), changeOrderStatusController);
router.get("/my-orders", authenticate, getMyOrdersController);
export default router;