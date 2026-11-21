
import {
  createOrder,
  getAllOrders,
  getOrderById,
  changeOrderStatus,
  getMyOrders,
  getMyShopOrders,
  getMyShopOrderById,
  changeMyShopOrderStatus,
  cancelMyOrder,
} from "../services/orderServices.js";

// ======================================================
// CREATE ORDERS
// POST /orders
// ======================================================

export const createOrderController = async (req, res) => {
  try {
    const result = await createOrder(
      req.user.userId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Orders created successfully.",
      data: result.orders,
      totalOrders: result.totalOrders,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// GET ALL ORDERS (ADMIN)
// GET /orders
// ======================================================

export const getAllOrdersController = async (req, res) => {
  try {
    const result = await getAllOrders({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully.",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get all orders error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// GET ORDER BY ID
// GET /orders/:id
// ======================================================

export const getOrderByIdController = async (req, res) => {
  try {
    const order = await getOrderById(
      req.params.id,
      req.user.userId,
      req.user.role
    );

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// GET MY ORDERS (CUSTOMER)
// GET /orders/my-orders
// ======================================================

export const getMyOrdersController = async (req, res) => {
  try {
    const result = await getMyOrders(
      req.user.userId,
      req.query.page,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Your orders retrieved successfully.",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// CANCEL MY ORDER (CUSTOMER)
// PATCH /orders/my-orders/:id/cancel
// ======================================================

export const cancelMyOrderController = async (req, res) => {
  try {
    const order = await cancelMyOrder(
      req.params.id,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Your order has been cancelled successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Cancel my order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// GET SHOP OWNER ORDERS
// GET /orders/my-shop
// ======================================================

export const getMyShopOrdersController = async (
  req,
  res
) => {
  try {
    const result = await getMyShopOrders(
      req.user.userId,
      req.query.page,
      req.query.limit,
      req.query.status
    );

    return res.status(200).json({
      success: true,
      message: "Shop orders retrieved successfully.",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get shop orders error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// GET SINGLE SHOP OWNER ORDER
// GET /orders/my-shop/:id
// ======================================================

export const getMyShopOrderByIdController = async (
  req,
  res
) => {
  try {
    const order = await getMyShopOrderById(
      req.params.id,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Shop order retrieved successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Get shop order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// CHANGE ORDER STATUS (ADMIN)
// PATCH /orders/status/:id
// ======================================================

export const changeOrderStatusController = async (
  req,
  res
) => {
  try {
    const order = await changeOrderStatus(
      req.params.id,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Change order status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

// ======================================================
// CHANGE ORDER STATUS (SHOP OWNER)
// PATCH /orders/my-shop/status/:id
// ======================================================

export const changeMyShopOrderStatusController = async (
  req,
  res
) => {
  try {
    const order = await changeMyShopOrderStatus(
      req.params.id,
      req.user.userId,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Shop order status updated successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Change shop order status error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};
