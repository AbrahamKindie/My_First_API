
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// 1. Create product review
export const createReview = async (userId, productId, data) => {
  const id = Number(productId);
  const customerId = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid product ID", 400);
  }

  // Check product exists.
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  // Verify that the customer has a delivered order containing this product.
  const deliveredOrderItem = await prisma.orderItem.findFirst({
    where: {
      productId: id,
      order: {
        userId: customerId,
        status: "DELIVERED",
      },
    },
  });

  if (!deliveredOrderItem) {
    throw createError(
      "You can review this product only after it has been delivered to you",
      403
    );
  }

  // Create review. The unique constraint prevents duplicate reviews.
  try {
    return await prisma.productReview.create({
      data: {
        productId: id,
        userId: customerId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError("You have already reviewed this product", 409);
    }

    throw error;
  }
};

// 2. Get reviews for a product
export const getProductReviews = async (
  productId,
  page = 1,
  limit = 10
) => {
  const id = Number(productId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid product ID", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  const where = { productId: id };

  const [reviews, total, ratingSummary] = await prisma.$transaction([
    prisma.productReview.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    prisma.productReview.count({ where }),

    prisma.productReview.aggregate({
      where,
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  return {
    reviews,
    summary: {
      averageRating: Number(
        (ratingSummary._avg.rating || 0).toFixed(1)
      ),
      totalReviews: ratingSummary._count.rating,
    },
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// 3. Update own review
export const updateReview = async (userId, reviewId, data) => {
  const id = Number(reviewId);
  const customerId = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid review ID", 400);
  }

  const review = await prisma.productReview.findUnique({
    where: { id },
  });

  if (!review) {
    throw createError("Review not found", 404);
  }

  if (review.userId !== customerId) {
    throw createError("You can only update your own review", 403);
  }

  return await prisma.productReview.update({
    where: { id },
    data,
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

// 4. Delete own review
export const deleteReview = async (userId, reviewId) => {
  const id = Number(reviewId);
  const customerId = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError("Invalid review ID", 400);
  }

  const review = await prisma.productReview.findUnique({
    where: { id },
  });

  if (!review) {
    throw createError("Review not found", 404);
  }

  if (review.userId !== customerId) {
    throw createError("You can only delete your own review", 403);
  }

  await prisma.productReview.delete({
    where: { id },
  });

  return { message: "Review deleted successfully" };
};
