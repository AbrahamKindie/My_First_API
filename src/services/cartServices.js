
import { id } from "zod/locales";
import prisma from "../db/prisma.js";

// Reusable error handler
const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Get or create an active cart
const getOrCreateActiveCart = async (tx, userId) => {
  let cart = await tx.cart.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
  });

  if (!cart) {
    cart = await tx.cart.create({
      data: { userId },
    });
  }

  return cart;
};

// Get cart with product details
const getCartWithItems = async (userId) => {
  return await prisma.cart.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              images: true,
              stock: true,
              categoryId: true,
            },
          },
        },
      },
    },
  });
};

// Calculate cart totals
const calculateCartTotals = (cart) => {
  const subtotal = cart.items.reduce((total, item) => {
    return total + Number(item.product.price) * item.quantity;
  }, 0);

  const totalItems = cart.items.reduce((total, item) => {
    return total + item.quantity;
  }, 0);

  return {
    ...cart,
    subtotal: Number(subtotal.toFixed(2)),
    totalItems,
  };
};

// Retry transactions affected by concurrent requests
const runCartTransaction = async (callback) => {
  let attempts = 3;

  while (attempts > 0) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      attempts--;

      if (
        attempts === 0 ||
        (error.code !== "P2034" && error.code !== "P2002")
      ) {
        throw error;
      }
    }
  }
};

// ==========================================
// 1. GET CART
// ==========================================

export const getCart = async (userId) => {
  let cart = await getCartWithItems(userId);

  if (!cart) {
    try {
      await prisma.cart.create({
        data: { userId },
      });
    } catch (error) {
      // Another concurrent request may have created the cart
      if (error.code !== "P2002") {
        throw error;
      }
    }

    cart = await getCartWithItems(userId);
  }

  return calculateCartTotals(cart);
};

// ==========================================
// 2. ADD TO CART
// ==========================================

export const addToCart = async (userId, productId, quantity = 1) => {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError("Invalid product ID.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createError("Quantity must be a positive integer.");
  }

  await runCartTransaction(async (tx) => {
    // Check product availability
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        stock: true,
      },
    });

    if (!product) {
      throw createError("Product not found.", 404);
    }

    if (product.stock <= 0) {
      throw createError("This product is out of stock.");
    }

    // Get or create the user's active cart
    const cart = await getOrCreateActiveCart(tx, userId);

    // Check whether product already exists in cart
    const existingItem = await tx.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    const newQuantity =
      (existingItem?.quantity || 0) + quantity;

    // Validate total requested quantity
    if (newQuantity > product.stock) {
      throw createError(
        `Only ${product.stock} units of ${product.name} are available.`
      );
    }

    // Create new item or increase existing quantity
    await tx.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
    });
  });

  return await getCart(userId);
};

// ==========================================
// 3. UPDATE CART ITEM QUANTITY
// ==========================================

export const updateCartItem = async (
  userId,
  cartItemId,
  quantity
) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createError("Quantity must be a positive integer.");
  }

  await runCartTransaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
    });

    if (!cart) {
      throw createError("Active cart not found.", 404);
    }

    const cartItem = await tx.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      include: {
        product: true,
      },
    });

    if (!cartItem) {
      throw createError("Cart item not found.", 404);
    }

    if (quantity > cartItem.product.stock) {
      throw createError(
        `Only ${cartItem.product.stock} units are available.`
      );
    }

    await tx.cartItem.update({
      where: {
        id: cartItemId,
      },
      data: {
        quantity,
      },
    });
  });

  return await getCart(userId);
};

// ==========================================
// 4. REMOVE ITEM FROM CART
// ==========================================

export const removeCartItem = async (userId, cartItemId) => {
  await runCartTransaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
    });

    if (!cart) {
      throw createError("Active cart not found.", 404);
    }

    const cartItem = await tx.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw createError("Cart item not found.", 404);
    }

    await tx.cartItem.delete({
      where: {
        id: cartItemId,
      },
    });
  });

  return await getCart(userId);
};

// ==========================================
// 5. CLEAR CART
// ==========================================

export const clearCart = async (userId) => {
  await runCartTransaction(async (tx) => {
    const cart = await tx.cart.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
    });

    if (!cart) {
      throw createError("Active cart not found.", 404);
    }

    await tx.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });
  });

  return await getCart(userId);
};
