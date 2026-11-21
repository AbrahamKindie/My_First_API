
import prisma from "../db/prisma.js";

// ==========================================
// REUSABLE ERROR HANDLER
// ==========================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================
// PRODUCT AVAILABILITY
// ==========================================

// A product is available only when:
// 1. Product status is ACTIVE.
// 2. Its shop status is ACTIVE.
//
// ADMIN_DEACTIVATED products cannot be purchased.

const isProductAvailable = (product) => {
  return (
    product?.status === "ACTIVE" &&
    product?.shop?.status === "ACTIVE"
  );
};

const validateProductAvailability = (product) => {
  if (!product) {
    throw createError("Product not found.", 404);
  }

  if (product.status !== "ACTIVE") {
    throw createError(
      "This product is currently unavailable.",
      409
    );
  }

  if (product.shop?.status !== "ACTIVE") {
    throw createError(
      "This product's shop is currently unavailable.",
      409
    );
  }
};

// ==========================================
// DISCOUNT CALCULATION
// ==========================================

const calculateDiscountedPrice = (product) => {
  const originalPrice = Number(product.price);
  const discount = product.discount;

  if (!discount || !discount.isActive) {
    return Number(originalPrice.toFixed(2));
  }

  const now = new Date();

  if (discount.startsAt && new Date(discount.startsAt) > now) {
    return Number(originalPrice.toFixed(2));
  }

  if (discount.endsAt && new Date(discount.endsAt) < now) {
    return Number(originalPrice.toFixed(2));
  }

  const discountValue = Number(discount.value);

  let discountedPrice;

  if (discount.type === "PERCENTAGE") {
    discountedPrice =
      originalPrice - (originalPrice * discountValue) / 100;
  } else {
    discountedPrice = originalPrice - discountValue;
  }

  discountedPrice = Math.max(0, discountedPrice);

  return Number(discountedPrice.toFixed(2));
};

// ==========================================
// GET OR CREATE ACTIVE CART
// ==========================================

const getOrCreateActiveCart = async (tx, userId) => {
  let cart = await tx.cart.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
  });

  if (!cart) {
    cart = await tx.cart.create({
      data: {
        userId,
      },
    });
  }

  return cart;
};

// ==========================================
// GET CART WITH PRODUCT DETAILS
// ==========================================

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
            include: {
              discount: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

// ==========================================
// CALCULATE CART TOTALS
// ==========================================

const calculateCartTotals = (cart) => {
  if (!cart) {
    return {
      items: [],
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      totalItems: 0,
      unavailableItems: 0,
    };
  }

  const items = cart.items.map((item) => {
    const originalPrice = Number(item.product.price);

    const discountedPrice = calculateDiscountedPrice(
      item.product
    );

    const discountAmount = Number(
      (originalPrice - discountedPrice).toFixed(2)
    );

    const itemSubtotal = Number(
      (originalPrice * item.quantity).toFixed(2)
    );

    const itemDiscount = Number(
      (discountAmount * item.quantity).toFixed(2)
    );

    const itemTotal = Number(
      (discountedPrice * item.quantity).toFixed(2)
    );

    const isAvailable = isProductAvailable(item.product);

    return {
      ...item,

      product: {
        ...item.product,
        originalPrice,
        discountedPrice,
        discountAmount,
      },

      isAvailable,

      itemSubtotal: isAvailable ? itemSubtotal : 0,
      itemDiscount: isAvailable ? itemDiscount : 0,
      itemTotal: isAvailable ? itemTotal : 0,
    };
  });

  const availableItems = items.filter(
    (item) => item.isAvailable
  );

  const subtotal = availableItems.reduce(
    (total, item) => total + item.itemSubtotal,
    0
  );

  const discountTotal = availableItems.reduce(
    (total, item) => total + item.itemDiscount,
    0
  );

  const total = availableItems.reduce(
    (sum, item) => sum + item.itemTotal,
    0
  );

  const totalItems = availableItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const unavailableItems = items.filter(
    (item) => !item.isAvailable
  ).length;

  return {
    ...cart,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    discountTotal: Number(discountTotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    totalItems,
    unavailableItems,
  };
};

// ==========================================
// RETRY SERIALIZABLE TRANSACTIONS
// ==========================================

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
        error.code !== "P2034"
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
        data: {
          userId,
        },
      });
    } catch (error) {
      if (error.code !== "P2002") {
        throw error;
      }
    }

    cart = await getCartWithItems(userId);
  }

  return calculateCartTotals(cart);
};

// ==========================================
// 2. ADD PRODUCT TO CART
// ==========================================

export const addToCart = async (
  userId,
  productId,
  quantity = 1
) => {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw createError("Invalid product ID.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createError(
      "Quantity must be a positive integer."
    );
  }

  await runCartTransaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        status: true,
        shop: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!product) {
      throw createError("Product not found.", 404);
    }

    // Prevent adding inactive or Admin-deactivated products.
    // Also prevent products from deactivated shops.

    validateProductAvailability(product);

    if (product.stock <= 0) {
      throw createError("This product is out of stock.");
    }

    const cart = await getOrCreateActiveCart(
      tx,
      userId
    );

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

    if (newQuantity > product.stock) {
      throw createError(
        `Only ${product.stock} units of ${product.name} are available.`
      );
    }

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
  if (
    !Number.isInteger(cartItemId) ||
    cartItemId <= 0
  ) {
    throw createError("Invalid cart item ID.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw createError(
      "Quantity must be a positive integer."
    );
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
        product: {
          include: {
            shop: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw createError("Cart item not found.", 404);
    }

    // Do not allow quantity changes for unavailable products.
    // The customer can still remove the unavailable item.

    validateProductAvailability(cartItem.product);

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

export const removeCartItem = async (
  userId,
  cartItemId
) => {
  if (
    !Number.isInteger(cartItemId) ||
    cartItemId <= 0
  ) {
    throw createError("Invalid cart item ID.");
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
    });

    if (!cartItem) {
      throw createError("Cart item not found.", 404);
    }

    // Customers can always remove unavailable products.

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
