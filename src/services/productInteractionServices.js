
import prisma from "../db/prisma.js";

// ==========================================
// COMMON HELPERS
// ==========================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (id, fieldName = "ID") => {
  const parsedId = Number(id);

  if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
    throw createError(`Invalid ${fieldName}`, 400);
  }

  return parsedId;
};

const validatePagination = (options = {}) => {
  const requestedPage = Number(options.page);
  const requestedLimit = Number(options.limit);

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const limit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 12;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const checkProductExists = async (productId) => {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      shop: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
};

const reportReasons = [
  "COUNTERFEIT",
  "MISLEADING_INFORMATION",
  "PROHIBITED_PRODUCT",
  "SUSPICIOUS_ACTIVITY",
  "OTHER",
];

const reportStatuses = [
  "PENDING",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
];

const activeReportStatuses = [
  "PENDING",
  "UNDER_REVIEW",
];

// ==========================================
// 1. LIKE PRODUCT
// ==========================================

export const likeProduct = async (userId, productId) => {
  const parsedUserId = validateId(userId, "user ID");
  const parsedProductId = validateId(productId, "product ID");

  await checkProductExists(parsedProductId);

  try {
    await prisma.productLike.create({
      data: {
        userId: parsedUserId,
        productId: parsedProductId,
      },
    });
  } catch (error) {
    if (error.code !== "P2002") {
      throw error;
    }
  }

  const totalLikes = await prisma.productLike.count({
    where: {
      productId: parsedProductId,
    },
  });

  return {
    message: "Product liked successfully",
    productId: parsedProductId,
    isLiked: true,
    totalLikes,
  };
};

// ==========================================
// 2. UNLIKE PRODUCT
// ==========================================

export const unlikeProduct = async (userId, productId) => {
  const parsedUserId = validateId(userId, "user ID");
  const parsedProductId = validateId(productId, "product ID");

  await checkProductExists(parsedProductId);

  await prisma.productLike.deleteMany({
    where: {
      userId: parsedUserId,
      productId: parsedProductId,
    },
  });

  const totalLikes = await prisma.productLike.count({
    where: {
      productId: parsedProductId,
    },
  });

  return {
    message: "Product unliked successfully",
    productId: parsedProductId,
    isLiked: false,
    totalLikes,
  };
};

// ==========================================
// 3. GET PRODUCT LIKE INFORMATION
// ==========================================

export const getProductLikes = async (
  productId,
  userId = null
) => {
  const parsedProductId = validateId(productId, "product ID");

  await checkProductExists(parsedProductId);

  const parsedUserId =
    userId === undefined || userId === null || userId === ""
      ? null
      : validateId(userId, "user ID");

  const [totalLikes, userLike] = await Promise.all([
    prisma.productLike.count({
      where: {
        productId: parsedProductId,
      },
    }),

    parsedUserId
      ? prisma.productLike.findUnique({
          where: {
            productId_userId: {
              productId: parsedProductId,
              userId: parsedUserId,
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    productId: parsedProductId,
    totalLikes,
    isLiked: Boolean(userLike),
  };
};

// ==========================================
// 4. GET MY LIKED PRODUCTS (WISHLIST)
// ==========================================

export const getMyLikedProducts = async (
  userId,
  options = {}
) => {
  const parsedUserId = validateId(userId, "user ID");

  const { page, limit, skip } = validatePagination(options);

  // Only return products currently available to customers.
  const where = {
    userId: parsedUserId,
    product: {
      status: "ACTIVE",
      shop: {
        status: "ACTIVE",
      },
    },
  };

  const [likes, total] = await prisma.$transaction([
    prisma.productLike.findMany({
      where,
      include: {
        product: {
          include: {
            productCategory: true,
            shop: {
              select: {
                id: true,
                name: true,
                logo: true,
                status: true,
                shopCategory: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            discount: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.productLike.count({
      where,
    }),
  ]);

  const products = likes.map((like) => ({
    ...like.product,
    price: Number(like.product.price),
    likedAt: like.createdAt,
  }));

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};


// ==========================================
// 5. REPORT PRODUCT
// ==========================================

export const reportProduct = async (
  userId,
  productId,
  data
) => {
  const parsedUserId = validateId(userId, "user ID");
  const parsedProductId = validateId(productId, "product ID");

  await checkProductExists(parsedProductId);

  const { reason, description } = data;

  if (
  description !== undefined &&
  description !== null &&
  typeof description !== "string"
) {
  throw createError("Invalid report description", 400);
}

if (typeof description === "string" && description.length > 500) {
  throw createError(
    "Report description cannot exceed 500 characters",
    400
  );
}

  if (!reportReasons.includes(reason)) {
    throw createError("Invalid product report reason", 400);
  }

  const cleanedDescription =
    typeof description === "string"
      ? description.trim() || null
      : null;

  try {
    const report = await prisma.$transaction(
      async (tx) => {
        const existingReport = await tx.productReport.findFirst({
          where: {
            userId: parsedUserId,
            productId: parsedProductId,
            status: {
              in: activeReportStatuses,
            },
          },
          select: {
            id: true,
          },
        });

        if (existingReport) {
          throw createError(
            "You already sent a report for this product",
            409
          );
        }

        return tx.productReport.create({
          data: {
            userId: parsedUserId,
            productId: parsedProductId,
            reason,
            description: cleanedDescription,
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
        });
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return {
      message: "Product reported successfully",
      report,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    if (error.code === "P2034") {
      throw createError(
        "A report for this product is already being submitted. Please try again.",
        409
      );
    }

    throw error;
  }
};

// ==========================================
// 6. GET MY PRODUCT REPORTS
// ==========================================

export const getMyProductReports = async (
  userId,
  options = {}
) => {
  const parsedUserId = validateId(userId, "user ID");

  const { page, limit, skip } = validatePagination(options);

  const where = {
    userId: parsedUserId,
  };

  const [reports, total] = await prisma.$transaction([
    prisma.productReport.findMany({
      where,
    include: {
  product: {
    include: {
      productCategory: true,
      shop: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      discount: true,
    },
  },
},
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.productReport.count({
      where,
    }),
  ]);

  return {
    reports: reports.map((report) => ({
      ...report,
      product: {
        ...report.product,
        price: Number(report.product.price),
      },
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ==========================================
// 7. GET ALL PRODUCT REPORTS (ADMIN)
// ==========================================

export const getAllProductReports = async (filters = {}) => {
  const { page, limit, skip } = validatePagination(filters);

  const where = {};

  if (filters.status) {
    if (!reportStatuses.includes(filters.status)) {
      throw createError("Invalid report status", 400);
    }

    where.status = filters.status;
  }

  if (filters.reason) {
    if (!reportReasons.includes(filters.reason)) {
      throw createError("Invalid report reason", 400);
    }

    where.reason = filters.reason;
  }

  if (filters.productId) {
    where.productId = validateId(
      filters.productId,
      "product ID"
    );
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim();

    where.OR = [
      {
        product: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        reporter: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        description: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  const [reports, total] = await prisma.$transaction([
    prisma.productReport.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            price: true,
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.productReport.count({
      where,
    }),
  ]);

  return {
    reports: reports.map((report) => ({
      ...report,
      product: {
        ...report.product,
        price: Number(report.product.price),
      },
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ==========================================
// 8. REVIEW PRODUCT REPORT (ADMIN)
// ==========================================


export const reviewProductReport = async (
  reportId,
  adminId,
  data
) => {
  const parsedReportId = validateId(
    reportId,
    "report ID"
  );

  const parsedAdminId = validateId(
    adminId,
    "admin ID"
  );

  const { status, adminNote } = data;

  if (
  adminNote !== undefined &&
  adminNote !== null &&
  typeof adminNote !== "string"
) {
  throw createError("Invalid admin note", 400);
}

if (typeof adminNote === "string" && adminNote.length > 500) {
  throw createError(
    "Admin note cannot exceed 500 characters",
    400
  );
}

  const allowedStatuses = [
    "UNDER_REVIEW",
    "RESOLVED",
    "DISMISSED",
  ];

  if (!allowedStatuses.includes(status)) {
    throw createError("Invalid report review status", 400);
  }

  const cleanedNote =
    typeof adminNote === "string"
      ? adminNote.trim() || null
      : null;

  return prisma.$transaction(async (tx) => {
    // ======================================
    // FIND EXISTING REPORT
    // ======================================

    const existingReport = await tx.productReport.findUnique({
      where: {
        id: parsedReportId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingReport) {
      throw createError("Product report not found", 404);
    }

    // ======================================
    // PREVENT REOPENING FINALIZED REPORTS
    // ======================================

    if (
      existingReport.status === "RESOLVED" ||
      existingReport.status === "DISMISSED"
    ) {
      throw createError(
        "This report has already been finalized",
        409
      );
    }

    // ======================================
    // UPDATE REPORT WITH CONCURRENCY CHECK
    // ======================================

    const updatedCount = await tx.productReport.updateMany({
      where: {
        id: parsedReportId,
        status: existingReport.status,
      },
      data: {
        status,
        adminNote: cleanedNote,
        reviewedById: parsedAdminId,
        reviewedAt: new Date(),
      },
    });

    if (updatedCount.count !== 1) {
      throw createError(
        "This report has already been updated. Please refresh and try again.",
        409
      );
    }

    // ======================================
    // RECORD ADMIN ACTIVITY
    // ======================================

    const action =
      status === "UNDER_REVIEW"
        ? "REVIEW_PRODUCT_REPORT"
        : status === "RESOLVED"
          ? "RESOLVE_PRODUCT_REPORT"
          : "DISMISS_PRODUCT_REPORT";

    await tx.adminActivityLog.create({
      data: {
        actorId: parsedAdminId,
        action,
        targetType: "PRODUCT_REPORT",
        targetId: parsedReportId,
        details: {
          productId: existingReport.productId,
          productName: existingReport.product.name,
          reporterId: existingReport.userId,
          reason: existingReport.reason,
          previousStatus: existingReport.status,
          newStatus: status,
          adminNote: cleanedNote,
        },
      },
    });

    // ======================================
    // RETURN UPDATED REPORT
    // ======================================

    const updatedReport = await tx.productReport.findUnique({
      where: {
        id: parsedReportId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return {
      message: "Product report reviewed successfully",
      report: updatedReport,
    };
  });
};

