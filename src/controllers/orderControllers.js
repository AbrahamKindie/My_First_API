
import {
  createOrder,
  getAllOrders,
  getOrderById,
  changeOrderStatus,
  getMyOrders
} from "../services/orderServices.js";

// Create order
export const createOrderController = async (req, res) => {
  try {
    const order = await createOrder(
      req.user.userId,
      req.body.items
    );

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal server error"
    });
}
};

// Get all orders
export const getAllOrdersController = async (req, res) => {
  try {
    const result = await getAllOrders({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

// Get order by ID
export const getOrderByIdController = async (req, res) => {
  try {
    const order = await getOrderById(
      req.params.id,
      req.user.userId,
      req.user.role
    );

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: order,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

export const getMyOrdersController = async (req, res) => {
  try {
    const result = await getMyOrders(
      req.user.userId,
      req.query.page,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Your orders retrieved successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Change order status
export const changeOrderStatusController = async (req, res) => {
  try {
    const order = await changeOrderStatus(
      req.params.id,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

