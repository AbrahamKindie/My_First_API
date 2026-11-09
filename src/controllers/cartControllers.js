
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../services/cartServices.js";

// GET /api/cart
export const getCartController = async (req, res) => {
  try {
    const cart = await getCart(req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Cart retrieved successfully.",
      data: cart,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// POST /api/cart/items
export const addToCartController = async (req, res) => {
  try {

  const { productId, quantity } = req.body;

    const cart = await addToCart(
      req.user.id,
     productId,
     quantity
    );

    return res.status(200).json({
      success: true,
      message: "Products added to cart successfully",
      data: cart,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};
// PATCH /api/cart/items/:id
export const updateCartItemController = async (req, res) => {
  try {
    const cart = await updateCartItem(
      req.user.id,
      Number(req.params.id),
      Number(req.body.quantity)
    );

    return res.status(200).json({
      success: true,
      message: "Cart item updated successfully.",
      data: cart,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE /api/cart/items/:id
export const removeCartItemController = async (req, res) => {
  try {
    const cart = await removeCartItem(
      req.user.id,
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully.",
      data: cart,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE /api/cart/items
export const clearCartController = async (req, res) => {
  try {
    const cart = await clearCart(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
      data: cart,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};
