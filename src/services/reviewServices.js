
import prisma from "../db/prisma.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate IDs
const validateId = (value, fieldName) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`Invalid ${fieldName}`, 400);
  }

  return id;
};

// Validate review data
const validateReviewData = (data, partial = false) => {
  const validatedData = {};

  if (!partial || data.rating !== undefined) {
    const rating = Number(data.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createError(
        "Rating must be an integer between 1 and 5",
        400
      );
    }

    validatedData.rating = rating;
  }

  if (!partial || data.comment !== undefined) {
    if (typeof data.comment !== "string" || !data.comment.trim()) {
      throw createError("Review comment is required", 400);
    }

    if (data.comment.trim().length > 1000) {
      throw createError(
        "Review comment cannot exceed 1000 characters",
        400
      );
    }

    validatedData.comment = data.comment.trim();
  }

  if (Object.keys(validatedData).length === 0) {
    throw createError("Provide a rating or comment to update", 400);
  }

  return validatedData;
};

// 1. Create product review
// Any authenticated customer can review any existing product.
export const createReview = async (userId, productId, data) => {
  const id = validateId(productId, "product ID");
  const customerId = validateId(userId, "user ID");

  const reviewData = validateReviewData(data);

  // Check whether the product exists
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  try {
    return await prisma.productReview.create({
      data: {
        productId: id,
        userId: customerId,
        ...reviewData,
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
    // Prevent the same customer from reviewing the same product twice
    if (error.code === "P2002") {
      throw createError(
        "You have already reviewed this product",
        409
      );
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
  const id = validateId(productId, "product ID");

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

  const [reviews, total, ratingSummary, ratingGroups] =
    await prisma.$transaction([
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

      prisma.productReview.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
    ]);

  // Initialize rating distribution
  const ratingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  ratingGroups.forEach((group) => {
    ratingDistribution[group.rating] = group._count.rating;
  });

  return {
    reviews,

    summary: {
      averageRating: Number(
        (ratingSummary._avg.rating || 0).toFixed(1)
      ),
      totalReviews: ratingSummary._count.rating,
      ratingDistribution,
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
  const id = validateId(reviewId, "review ID");
  const customerId = validateId(userId, "user ID");

  const reviewData = validateReviewData(data, true);

  const review = await prisma.productReview.findUnique({
    where: { id },
  });

  if (!review) {
    throw createError("Review not found", 404);
  }

  // Customers can only update their own reviews
  if (review.userId !== customerId) {
    throw createError(
      "You can only update your own review",
      403
    );
  }

  return prisma.productReview.update({
    where: { id },
    data: reviewData,
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


/**
 * 4. Get all reviews for the authenticated Shop Owner's shop
 */
export const getMyShopReviews = async (
  ownerId,
  page = 1,
  limit = 10
) => {
  const userId = validateId(ownerId, "user ID");

  // Find the shop owned by the authenticated user
  const shop = await prisma.shop.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!shop) {
    throw createError("Shop not found", 404);
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  // Only reviews for products belonging to this owner's shop
  const where = {
    product: {
      shopId: shop.id,
    },
  };

  const [reviews, total, ratingSummary, ratingGroups] =
    await prisma.$transaction([
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
          product: {
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

      prisma.productReview.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
    ]);

  const ratingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  ratingGroups.forEach((group) => {
    ratingDistribution[group.rating] = group._count.rating;
  });

  return {
    shop: {
      id: shop.id,
      name: shop.name,
    },

    reviews,

    summary: {
      averageRating: Number(
        (ratingSummary._avg.rating || 0).toFixed(1)
      ),
      totalReviews: ratingSummary._count.rating,
      ratingDistribution,
    },

    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

