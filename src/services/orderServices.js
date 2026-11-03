import prisma from "../db/prisma.js";

export const createOrder = async (userId, items) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Combine duplicate product IDs
    const productQuantities = new Map();

    for (const item of items) {
      const currentQuantity =
        productQuantities.get(item.productId) || 0;

      productQuantities.set(
        item.productId,
        currentQuantity + item.quantity
      );
    }

    const normalizedItems = Array.from(
      productQuantities,
      ([productId, quantity]) => ({
        productId,
        quantity,
      })
    );

    // 2. Find the requested products
    const products = await tx.product.findMany({
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId),
        },
      },
    });

    // 3. Check whether every product exists
    if (products.length !== normalizedItems.length) {
      throw new Error("One or more products were not found");
    }

    const productMap = new Map(
      products.map((product) => [product.id, product])
    );

    // 4. Check stock and calculate the total
    let totalPrice = 0;

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for product: ${product.name}`
        );
      }

      totalPrice += Number(product.price) * item.quantity;
    }

    // 5. Decrease stock safely
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
        throw new Error(
          `Insufficient stock for product ID: ${item.productId}`
        );
      }
    }

    // 6. Create the order and its order items
    const order = await tx.order.create({
      data: {
        userId,
        totalPrice: totalPrice.toFixed(2),
        items: {
          create: normalizedItems.map((item) => {
            const product = productMap.get(item.productId);

            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
            };
          }),
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

    return order;
  });
};


// 1. Get all orders (Admin only)
export const getAllOrders = async ({ page = 1, limit = 10, status } = {}) => {
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

// 2. Get one order by ID
export const getOrderById = async (orderId, userId, role) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
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
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Regular users can view only their own orders.
  if (role !== "ADMIN" && order.userId !== Number(userId)) {
    const error = new Error("You are not allowed to view this order");
    error.statusCode = 403;
    throw error;
  }

  return order;
};

// Get My Orders (Regular users only)
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

// 3. Change order status (Admin only)
export const changeOrderStatus = async (orderId, newStatus) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  const allowedStatuses = [
    "PENDING",
    "CONFIRMED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ];

  if (!allowedStatuses.includes(newStatus)) {
    const error = new Error("Invalid order status");
    error.statusCode = 400;
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Prevent invalid status transitions.
  const allowedTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  if (!allowedTransitions[order.status].includes(newStatus)) {
    const error = new Error(
      `Cannot change order status from ${order.status} to ${newStatus}`
    );
    error.statusCode = 400;
    throw error;
  }

  return await prisma.order.update({
    where: { id },
    data: { status: newStatus },
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
};
