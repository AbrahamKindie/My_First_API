
import { Router } from "express";

import {
  createOrderController,
  getAllOrdersController,
  getOrderByIdController,
  changeOrderStatusController,
  getMyOrdersController,
  cancelMyOrderController,
  getMyShopOrdersController,
  getMyShopOrderByIdController,
  changeMyShopOrderStatusController,
} from "../controllers/orderControllers.js";

import authenticate from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import requireShopOwner from "../middleware/requireShopOwner.js";
import requirePermission from "../middleware/requirePermission.js";
import validate from "../middleware/validateMiddleware.js";

import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validators/orderValidation.js";

const router = Router();

// ======================================================
// CONDITIONAL ADMIN ORDER VIEW PERMISSION
// Customers can access their own orders.
// Admins require VIEW_ORDERS.
// Super Admins bypass permission checks.
// ======================================================

const requireOrderViewPermission = (req, res, next) => {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) {
    return requirePermission("VIEW_ORDERS")(req, res, next);
  }

  return next();
};

// ======================================================
// CUSTOMER CHECKOUT
// POST /orders
// ======================================================

router.post(
  "/",
  authenticate,
  validate(createOrderSchema),
  createOrderController
);

// ======================================================
// ADMIN - GET ALL ORDERS
// GET /orders
// ======================================================

router.get(
  "/",
  authenticate,
  requireAdmin,
  requirePermission("VIEW_ORDERS"),
  getAllOrdersController
);

// ======================================================
// CUSTOMER - GET MY ORDERS
// GET /orders/my-orders
// ======================================================

router.get(
  "/my-orders",
  authenticate,
  getMyOrdersController
);

// ======================================================
// CUSTOMER - CANCEL MY PENDING ORDER
// PATCH /orders/my-orders/:id/cancel
// ======================================================

router.patch(
  "/my-orders/:id/cancel",
  authenticate,
  cancelMyOrderController
);

// ======================================================
// SHOP OWNER - GET SHOP ORDERS
// GET /orders/my-shop
// ======================================================

router.get(
  "/my-shop",
  authenticate,
  requireShopOwner,
  getMyShopOrdersController
);

// ======================================================
// SHOP OWNER - GET SINGLE SHOP ORDER
// GET /orders/my-shop/:id
// ======================================================

router.get(
  "/my-shop/:id",
  authenticate,
  requireShopOwner,
  getMyShopOrderByIdController
);

// ======================================================
// SHOP OWNER - UPDATE ORDER STATUS
// PATCH /orders/my-shop/status/:id
// ======================================================

router.patch(
  "/my-shop/status/:id",
  authenticate,
  requireShopOwner,
  validate(updateOrderStatusSchema),
  changeMyShopOrderStatusController
);

// ======================================================
// ADMIN - UPDATE ORDER STATUS
// PATCH /orders/status/:id
// ======================================================

router.patch(
  "/status/:id",
  authenticate,
  requireAdmin,
  requirePermission("UPDATE_ORDERS"),
  validate(updateOrderStatusSchema),
  changeOrderStatusController
);

// ======================================================
// GET ORDER BY ID
// GET /orders/:id
//
// Customers: Only their own orders.
// Admins: Require VIEW_ORDERS.
// Super Admins: Full access.
// ======================================================

router.get(
  "/:id",
  authenticate,
  requireOrderViewPermission,
  getOrderByIdController
);

export default router;
