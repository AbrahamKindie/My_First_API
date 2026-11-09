
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Calculate the price after applying an active discount.
const calculateDiscountedPrice = (product) => {
  const originalPrice = Number(product.price);
  const discount = product.discount;

  if (!discount || !discount.isActive) {
    return originalPrice;
  }

  const now = new Date();

  if (discount.startsAt && new Date(discount.startsAt) > now) {
    return originalPrice;
  }

  if (discount.endsAt && new Date(discount.endsAt) < now) {
    return originalPrice;
  }

  const discountValue = Number(discount.value);

  let finalPrice;

  if (discount.type === "PERCENTAGE") {
    finalPrice = originalPrice - (originalPrice * discountValue) / 100;
  } else {
    finalPrice = originalPrice - discountValue;
  }

  if (finalPrice < 0) {
    throw createError(
      `Invalid discount configuration for product: ${product.name}`,
      400
    );
  }

  // Keep prices accurate to two decimal places.
  return Math.round(finalPrice * 100) / 100;
};

// 1. Create order
export const createOrder = async (userId, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createError("Order must contain at least one product");
  }

  return await prisma.$transaction(async (tx) => {
    // Combine duplicate product IDs.
    const productQuantities = new Map();

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isSafeInteger(productId) || productId <= 0) {
        throw createError("Invalid product ID");
      }

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw createError("Product quantity must be a positive integer");
      }

      productQuantities.set(
        productId,
        (productQuantities.get(productId) || 0) + quantity
      );
    }

    const normalizedItems = Array.from(
      productQuantities,
      ([productId, quantity]) => ({
        productId,
        quantity,
      })
    );

    // Find products and their discounts.
    const products = await tx.product.findMany({
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId),
        },
      },
      include: {
        discount: true,
      },
    });

    if (products.length !== normalizedItems.length) {
      throw createError("One or more products were not found", 404);
    }

    const productMap = new Map(
      products.map((product) => [product.id, product])
    );

    // Check stock and calculate discounted prices.
    let totalPrice = 0;

    const orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);

      if (product.stock < item.quantity) {
        throw createError(
          `Insufficient stock for product: ${product.name}`,
          400
        );
      }

      const finalPrice = calculateDiscountedPrice(product);

      totalPrice += finalPrice * item.quantity;

      return {
        productId: product.id,
        quantity: item.quantity,
        price: finalPrice.toFixed(2),
      };
    });

    totalPrice = Math.round(totalPrice * 100) / 100;

    // Decrease stock safely.
    for (const item of normalizedItems) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          stock: {
            gte: item.quantity,
          },
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      if (result.count !== 1) {
        throw createError(
          `Insufficient stock for product ID: ${item.productId}`,
          400
        );
      }
    }

    // Create order with the actual purchase prices.
    return await tx.order.create({
      data: {
        userId: Number(userId),
        totalPrice: totalPrice.toFixed(2),
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  });
};

// 2. Get all orders (Admin only)
export const getAllOrders = async ({
  page = 1,
  limit = 10,
  status,
} = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  const where = status ? { status } : {};

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// 3. Get one order by ID
export const getOrderById = async (orderId, userId, role) => {
  const id = Number(orderId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid order ID", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw createError("Order not found", 404);
  }

  if (role !== "ADMIN" && order.userId !== Number(userId)) {
    throw createError("You are not allowed to view this order", 403);
  }

  return order;
};

// 4. Get my orders
export const getMyOrders = async (userId, page = 1, limit = 10) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  const where = {
    userId: Number(userId),
  };

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// 5. Change order status (Admin only)
export const changeOrderStatus = async (orderId, newStatus) => {
  const id = Number(orderId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid order ID", 400);
  }

  const allowedTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  if (!Object.hasOwn(allowedTransitions, newStatus)) {
    throw createError("Invalid order status", 400);
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw createError("Order not found", 404);
    }

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw createError(
        `Cannot change order status from ${order.status} to ${newStatus}`,
        400
      );
    }

    // Update only if the status has not changed since it was read.
    const updated = await tx.order.updateMany({
      where: {
        id,
        status: order.status,
      },
      data: {
        status: newStatus,
      },
    });

    if (updated.count !== 1) {
      throw createError(
        "Order status was changed by another request. Please try again.",
        409
      );
    }

    // Restore reserved stock when an order is cancelled.
    if (newStatus === "CANCELLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    return await tx.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  });
};
