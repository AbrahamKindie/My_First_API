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

const validateProductAvailability = (product) => {
  if (!product || product.status !== "ACTIVE") {
    throw createError(
      `${product?.name || "This product"} is no longer available.`,
      409
    );
  }

  if (product.shop?.status !== "ACTIVE") {
    throw createError(
      `${product.name} is currently unavailable because its shop is deactivated.`,
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

  if (discountedPrice < 0) {
    throw createError(
      `Invalid discount configuration for ${product.name}.`
    );
  }

  return Number(discountedPrice.toFixed(2));
};

// ==========================================
// SERIALIZABLE TRANSACTION
// ==========================================

const runSerializableTransaction = async (callback) => {
  let attempts = 3;

  while (attempts > 0) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      attempts--;

      if (attempts === 0 || error.code !== "P2034") {
        throw error;
      }
    }
  }
};

// ==========================================
// PAGINATION
// ==========================================

const getPagination = (page, limit) => {
  const currentPage = Math.max(1, Number(page) || 1);

  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 10)
  );

  return {
    page: currentPage,
    limit: pageSize,
    skip: (currentPage - 1) * pageSize,
  };
};

// ==========================================
// GET SHOP OWNED BY USER
// ==========================================

const getOwnedShop = async (userId, db = prisma) => {
  const shop = await db.shop.findFirst({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!shop) {
    throw createError(
      "You do not have a registered shop.",
      404
    );
  }

  // Only active shops can access shop management services.

  if (shop.status !== "ACTIVE") {
    throw createError(
      "Your shop is deactivated.",
      403
    );
  }

  return shop;
};

// ======================================================
// CREATE ORDERS FROM ACTIVE CART
// ONE ORDER PER SHOP
// ======================================================

export const createOrder = async (userId, checkoutData) => {
  const {
    shippingName,
    shippingPhone,
    shippingAddress,
    shippingCity,
    shippingCountry = "Ethiopia",
    paymentMethod,
  } = checkoutData;

  return await runSerializableTransaction(async (tx) => {
    // 1. Find the customer's active cart.

    const cart = await tx.cart.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        items: {
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

    if (!cart || cart.items.length === 0) {
      throw createError("Your cart is empty.", 400);
    }

    // 2. Group cart items by shop.

    const shopGroups = new Map();

    for (const item of cart.items) {
      const product = item.product;

      validateProductAvailability(product);

      if (product.stock < item.quantity) {
        throw createError(
          `Only ${product.stock} units of ${product.name} are available.`,
          400
        );
      }

      const shopId = product.shop.id;

      if (!shopGroups.has(shopId)) {
        shopGroups.set(shopId, {
          shopId,
          items: [],
          totalPrice: 0,
        });
      }

      const unitPrice = calculateDiscountedPrice(product);

      const group = shopGroups.get(shopId);

      group.items.push({
        productId: product.id,
        quantity: item.quantity,
        price: unitPrice,
      });

      group.totalPrice += unitPrice * item.quantity;
    }

    // 3. Reduce stock safely for every cart item.
    // The product and its shop must still be ACTIVE.

    for (const item of cart.items) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          status: "ACTIVE",
          stock: {
            gte: item.quantity,
          },
          shop: {
            is: {
              status: "ACTIVE",
            },
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
          `${item.product.name} is no longer available or does not have enough stock. Please review your cart.`,
          409
        );
      }
    }

    // 4. Create one independent order for each shop.

    const createdOrders = [];

    for (const group of shopGroups.values()) {
      const totalPrice = Number(group.totalPrice.toFixed(2));

      const order = await tx.order.create({
        data: {
          userId,
          shopId: group.shopId,
          totalPrice,

          shippingName,
          shippingPhone,
          shippingAddress,
          shippingCity,
          shippingCountry,

          paymentMethod,
          paymentStatus: "PENDING",

          items: {
            create: group.items,
          },
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      createdOrders.push(order);
    }

    // 5. Convert the cart after every order is successfully created.

    await tx.cart.update({
      where: {
        id: cart.id,
      },
      data: {
        status: "CONVERTED",
      },
    });

    // 6. Return all created orders.

    return {
      orders: createdOrders,
      totalOrders: createdOrders.length,
    };
  });
};

// ======================================================
// GET ALL ORDERS (ADMIN)
// ======================================================

export const getAllOrders = async ({
  page = 1,
  limit = 10,
  status,
} = {}) => {
  const pagination = getPagination(page, limit);

  const where = {};

  if (status) {
    const allowedStatuses = [
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw createError("Invalid order status.");
    }

    where.status = status;
  }

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
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
      currentPage: pagination.page,
      totalPages: Math.ceil(
        totalOrders / pagination.limit
      ),
      totalOrders,
      limit: pagination.limit,
    },
  };
};

// ======================================================
// GET ORDER BY ID
// CUSTOMER / SHOP OWNER / ADMIN / SUPER ADMIN
// ======================================================

export const getOrderById = async (
  orderId,
  userId,
  role
) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid order ID.", 400);
  }

  const order = await prisma.order.findUnique({
    where: {
      id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
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
    throw createError("Order not found.", 404);
  }

  // ==========================================
  // ORDER ACCESS AUTHORIZATION
  // ==========================================

  if (role === "SHOP_OWNER") {
    // Shop Owners can only access orders belonging
    // to their own ACTIVE shop.

    const shop = await getOwnedShop(userId);

    if (order.shopId !== shop.id) {
      throw createError(
        "You are not authorized to access this order.",
        403
      );
    }
  } else if (
    !["ADMIN", "SUPER_ADMIN"].includes(role) &&
    order.userId !== userId
  ) {
    // Customers can only access their own orders.

    throw createError(
      "You are not authorized to access this order.",
      403
    );
  }

  return order;
};

// ======================================================
// GET LOGGED-IN CUSTOMER ORDERS
// ======================================================

export const getMyOrders = async (
  userId,
  page = 1,
  limit = 10
) => {
  const pagination = getPagination(page, limit);

  const where = {
    userId,
  };

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
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
      currentPage: pagination.page,
      totalPages: Math.ceil(
        totalOrders / pagination.limit
      ),
      totalOrders,
      limit: pagination.limit,
    },
  };
};

// ======================================================
// GET ORDERS FOR LOGGED-IN SHOP OWNER
// ======================================================

export const getMyShopOrders = async (
  userId,
  page = 1,
  limit = 10,
  status
) => {
  // Verifies shop ownership and ACTIVE status.

  const shop = await getOwnedShop(userId);

  const pagination = getPagination(page, limit);

  const where = {
    shopId: shop.id,
  };

  if (status) {
    const allowedStatuses = [
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw createError("Invalid order status.");
    }

    where.status = status;
  }

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
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
      currentPage: pagination.page,
      totalPages: Math.ceil(
        totalOrders / pagination.limit
      ),
      totalOrders,
      limit: pagination.limit,
    },
  };
};

// ======================================================
// GET SINGLE ORDER FOR SHOP OWNER
// ======================================================

export const getMyShopOrderById = async (
  orderId,
  userId
) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid order ID.", 400);
  }

  // Verifies shop ownership and ACTIVE status.

  const shop = await getOwnedShop(userId);

  const order = await prisma.order.findFirst({
    where: {
      id,
      shopId: shop.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
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
    throw createError("Order not found.", 404);
  }

  return order;
};

// ======================================================
// CHANGE ORDER STATUS (ADMIN)
// ======================================================

export const changeOrderStatus = async (
  orderId,
  newStatus
) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid order ID.", 400);
  }

  const allowedTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  return await runSerializableTransaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw createError("Order not found.", 404);
    }

    const allowedNextStatuses = allowedTransitions[order.status];

    if (!allowedNextStatuses?.includes(newStatus)) {
      throw createError(
        `Cannot change order status from ${order.status} to ${newStatus}.`
      );
    }

    // Paid orders cannot be cancelled before refund processing.

    if (newStatus === "CANCELLED" && order.paymentStatus === "PAID") {
      throw createError(
        "This order has already been paid. Process the refund before cancelling it.",
        409
      );
    }

    // Atomic status update prevents concurrent stock restoration.

    const updateResult = await tx.order.updateMany({
      where: {
        id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      data: {
        status: newStatus,
      },
    });

    if (updateResult.count !== 1) {
      throw createError(
        "This order was updated by another request. Refresh the order and try again.",
        409
      );
    }

    // Restore stock only after successfully changing the status.

    if (newStatus === "CANCELLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
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
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
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

// ======================================================
// CHANGE ORDER STATUS (SHOP OWNER)
// ======================================================

export const changeMyShopOrderStatus = async (
  orderId,
  userId,
  newStatus
) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid order ID.", 400);
  }

  const allowedTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  return await runSerializableTransaction(async (tx) => {
    // Verify shop ownership and ACTIVE status inside the transaction.

    const shop = await getOwnedShop(userId, tx);

    const order = await tx.order.findFirst({
      where: {
        id,
        shopId: shop.id,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw createError("Order not found.", 404);
    }

    const allowedNextStatuses = allowedTransitions[order.status];

    if (!allowedNextStatuses?.includes(newStatus)) {
      throw createError(
        `Cannot change order status from ${order.status} to ${newStatus}.`
      );
    }

    // Paid orders cannot be cancelled before refund processing.

    if (newStatus === "CANCELLED" && order.paymentStatus === "PAID") {
      throw createError(
        "This order has already been paid. Process the refund before cancelling it.",
        409
      );
    }

    // Atomic status update prevents concurrent stock restoration.

    const updateResult = await tx.order.updateMany({
      where: {
        id,
        shopId: shop.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      data: {
        status: newStatus,
      },
    });

    if (updateResult.count !== 1) {
      throw createError(
        "This order was updated by another request. Refresh the order and try again.",
        409
      );
    }

    // Restore stock only after successfully changing the status.

    if (newStatus === "CANCELLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
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
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
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

// ======================================================
// CANCEL OWN ORDER (CUSTOMER)
// Customers can cancel only their own PENDING orders.
// ======================================================

export const cancelMyOrder = async (orderId, userId) => {
  const id = Number(orderId);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid order ID.", 400);
  }

  return await runSerializableTransaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, userId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        items: true,
      },
    });

    if (!order) {
      throw createError("Order not found.", 404);
    }

    if (order.status !== "PENDING") {
      throw createError(
        "You can only cancel an order while it is pending.",
        409
      );
    }

    if (order.paymentStatus === "PAID") {
      throw createError(
        "This order has already been paid. Please contact support.",
        409
      );
    }

    // Compare-and-set ensures only one cancellation request can restore stock.

    const updateResult = await tx.order.updateMany({
      where: {
        id,
        userId,
        status: "PENDING",
        paymentStatus: order.paymentStatus,
      },
      data: { status: "CANCELLED" },
    });

    if (updateResult.count !== 1) {
      throw createError(
        "This order has already been updated. Please refresh and try again.",
        409
      );
    }

    // Restore stock in the same transaction as the status change.

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    const recipients = [
      {
        userId: order.user.id,
        email: order.user.email,
        name: order.user.name,
      },
      {
        userId: order.shop.owner.id,
        email: order.shop.owner.email,
        name: order.shop.owner.name,
      },
    ];

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
    const orderLink = frontendUrl
      ? `${frontendUrl}/orders/${order.id}`
      : null;

    const notificationData = recipients.map((recipient) => ({
      userId: recipient.userId,
      orderId: order.id,
      type: "ORDER_CANCELLED_BY_CUSTOMER",
      title: "Order cancelled by customer",
      message: `Order #${order.id} was cancelled by the customer. The reserved product stock has been restored.`,
      link: orderLink,
      isRead: false,
    }));

    await tx.notification.createMany({
      data: notificationData,
      skipDuplicates: true,
    });

    const emailJobData = recipients
      .filter((recipient) => recipient.email)
      .map((recipient) => ({
        orderId: order.id,
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        recipientName: recipient.name || "ShopEase User",
        type: "CUSTOMER_CANCELLATION",
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
      }));

    await tx.orderEmailJob.createMany({
      data: emailJobData,
      skipDuplicates: true,
    });

    return await tx.order.findUnique({
      where: { id },
      include: {
        shop: {
          select: { id: true, name: true, logo: true },
        },
        items: {
          include: { product: true },
        },
      },
    });
  });
};