
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate notification ID
const validateNotificationId = (id) => {
  const notificationId = Number(id);

  if (
    !Number.isSafeInteger(notificationId) ||
    notificationId <= 0
  ) {
    throw createError("Invalid notification ID", 400);
  }

  return notificationId;
};

// Create a notification for every active customer.
// The optional db parameter allows this to run inside a Prisma transaction.
export const notifyAllCustomers = async (
  notification,
  db = prisma
) => {
  const customers = await db.user.findMany({
    where: {
      role: "USER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!customers.length) {
    return { count: 0 };
  }

  const now = new Date();

  const result = await db.notification.createMany({
    data: customers.map((customer) => ({
      userId: customer.id,
      productId: notification.productId ?? null,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link ?? null,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    })),
  });

  return { count: result.count };
};

// Get notifications belonging to one customer
export const getUserNotifications = async (
  userId,
  options = {}
) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(options.limit) || 10)
  );

  const skip = (page - 1) * limit;

  const where = { userId };

  const [notifications, total, unreadCount] =
    await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
      }),

      prisma.notification.count({ where }),

      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get unread notification count
export const getUnreadNotificationCount = async (userId) => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};

// Mark one notification as read
export const markNotificationAsRead = async (
  userId,
  id
) => {
  const notificationId = validateNotificationId(id);

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw createError("Notification not found", 404);
  }

  if (!notification.isRead) {
    await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
      },
    });
  }

  return {
    ...notification,
    isRead: true,
  };
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return {
    count: result.count,
    message: "All notifications marked as read",
  };
};

// Delete one notification belonging to the customer
export const deleteNotification = async (userId, id) => {
  const notificationId = validateNotificationId(id);

  const result = await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (result.count === 0) {
    throw createError("Notification not found", 404);
  }

  return {
    message: "Notification deleted successfully",
  };
};
