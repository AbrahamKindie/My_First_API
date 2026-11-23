
import prisma from "../db/prisma.js";
import { notifyAllCustomers } from "./notificationServices.js";

// ==========================================
// COMMON HELPERS
// ==========================================

const MAX_PRODUCT_IMAGES = 10;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================
// PRODUCT IMAGE VALIDATION
// ==========================================


const validateProductImages = (images) => {
  if (!Array.isArray(images)) {
    throw createError("Invalid product images", 400);
  }

  if (images.length > MAX_PRODUCT_IMAGES) {
    throw createError(
      `A product cannot have more than ${MAX_PRODUCT_IMAGES} images`,
      400
    );
  }

  const normalizedImages = images.map((image) => {
    if (typeof image !== "string" || !image.trim()) {
      throw createError("Invalid product image path", 400);
    }

    return image.trim();
  });

  const invalidImage = normalizedImages.some((image) => {
    return (
      !image.startsWith("/uploads/products/") ||
      image.includes("..") ||
      image.includes("\\") ||
      image.includes("?") ||
      image.includes("#")
    );
  });

  if (invalidImage) {
    throw createError(
      "Product images must use valid uploaded product image paths",
      400
    );
  }

  if (new Set(normalizedImages).size !== normalizedImages.length) {
    throw createError(
      "Duplicate product images are not allowed",
      400
    );
  }

  return normalizedImages;
};


const parseRetainedImages = (value) => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw createError("Invalid retained images format", 400);
    }
  }

  if (!Array.isArray(value)) {
    throw createError("Invalid retained images", 400);
  }

  return value;
};


// ==========================================
// ID VALIDATION
// ==========================================

const validateProductId = (id) => {
  const productId = Number(id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError("Invalid product ID", 400);
  }

  return productId;
};

const validateCategoryId = (id) => {
  const categoryId = Number(id);

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw createError("Invalid product category ID", 400);
  }

  return categoryId;
};

const validateShopCategoryId = (id) => {
  const categoryId = Number(id);

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw createError("Invalid shop category ID", 400);
  }

  return categoryId;
};

const validateShopId = (id) => {
  const shopId = Number(id);

  if (!Number.isSafeInteger(shopId) || shopId <= 0) {
    throw createError("Invalid shop ID", 400);
  }

  return shopId;
};

// ==========================================
// ADMIN PRODUCT AUTHORIZATION
// ==========================================


const validateAdminProductPermission = async (
  tx,
  actor,
  requiredPermission
) => {
  const actorId = Number(
    typeof actor === "object"
      ? actor?.userId ?? actor?.id
      : actor
  );

  if (!Number.isSafeInteger(actorId) || actorId <= 0) {
    throw createError("Authentication required.", 401);
  }

  const currentUser = await tx.user.findUnique({
    where: {
      id: actorId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      adminRoleId: true,

      adminRole: {
        select: {
          id: true,
          name: true,
          isActive: true,

          permissions: {
            where: {
              permission: {
                isActive: true,
              },
            },
            select: {
              permission: {
                select: {
                  key: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!currentUser || !currentUser.isActive) {
    throw createError(
      "Your account is inactive or unavailable.",
      403
    );
  }

  if (
    currentUser.role !== "ADMIN" &&
    currentUser.role !== "SUPER_ADMIN"
  ) {
    throw createError(
      "Only Admin or Super Admin can perform this action.",
      403
    );
  }

  // Super Admin has unrestricted Admin access.
  if (currentUser.role === "SUPER_ADMIN") {
    return currentUser;
  }

  if (!requiredPermission) {
    throw createError(
      "A valid permission is required.",
      403
    );
  }

  // Admin must have an assigned, active, matching role.
  if (
    !currentUser.adminRole ||
    !currentUser.adminRole.isActive ||
    currentUser.adminRole.id !== currentUser.adminRoleId
  ) {
    throw createError(
      "Your assigned Admin Role is invalid or inactive.",
      403
    );
  }

  // Retrieve active permissions from the database.
  const adminPermissions = [
    ...new Set(
      currentUser.adminRole.permissions
        .map((item) => item.permission?.key)
        .filter(
          (key) =>
            typeof key === "string" &&
            key.trim().length > 0 &&
            key !== "MANAGE_ADMIN_PERMISSIONS"
        )
    ),
  ];

  if (!adminPermissions.includes(requiredPermission)) {
    throw createError(
      `You do not have permission to perform this action. Required permission: ${requiredPermission}.`,
      403
    );
  }

  return currentUser;
};


// ==========================================
// ADMIN PRODUCT STATUS AUTHORIZATION
// ==========================================

const validateProductStatusPermission = async (
  tx,
  actor,
  requestedStatus
) => {
  const requiredPermission =
    requestedStatus === "ACTIVE"
      ? "ACTIVATE_PRODUCTS"
      : requestedStatus === "ADMIN_DEACTIVATED"
        ? "DEACTIVATE_PRODUCTS"
        : null;

  if (!requiredPermission) {
    throw createError("Invalid product status.", 400);
  }

  return validateAdminProductPermission(
    tx,
    actor,
    requiredPermission
  );
};

// ==========================================
// PRODUCT INCLUDE
// ==========================================

const productInclude = {
  productCategory: true,
  shop: {
    select: {
      id: true,
      name: true,
      logo: true,
      status: true,
    },
  },
  discount: true,
};

// ==========================================
// PRODUCT CATEGORY HELPERS
// ==========================================

const validateProductCategory = async (shopId, categoryId) => {
  const parsedShopId = validateShopId(shopId);
  const parsedCategoryId = validateCategoryId(categoryId);

  const category = await prisma.productCategory.findFirst({
    where: {
      id: parsedCategoryId,
      shopId: parsedShopId,
    },
    select: {
      id: true,
      shopId: true,
    },
  });

  if (!category) {
    throw createError(
      "Product category not found in this shop",
      404
    );
  }

  return category.id;
};

// ==========================================
// DISCOUNT HELPERS
// ==========================================

const isDiscountCurrentlyActive = (discount) => {
  if (!discount || !discount.isActive) {
    return false;
  }

  const now = new Date();

  const startsAt = discount.startsAt
    ? new Date(discount.startsAt)
    : null;

  const endsAt = discount.endsAt
    ? new Date(discount.endsAt)
    : null;

  return (
    (!startsAt || startsAt <= now) &&
    (!endsAt || endsAt >= now)
  );
};

const calculateProductPricing = (product) => {
  const originalPrice = Number(product.price);
  const discount = product.discount;

  let activeDiscount = null;
  let discountAmount = 0;
  let discountedPrice = originalPrice;

  if (isDiscountCurrentlyActive(discount)) {
    const value = Number(discount.value);

    if (discount.type === "PERCENTAGE") {
      discountAmount = (originalPrice * value) / 100;
    } else {
      discountAmount = value;
    }

    discountAmount = Math.min(discountAmount, originalPrice);
    discountedPrice = Math.max(0, originalPrice - discountAmount);

    discountAmount = Math.round(discountAmount * 100) / 100;
    discountedPrice = Math.round(discountedPrice * 100) / 100;

    activeDiscount = discount;
  }

  return {
    originalPrice,
    discount: activeDiscount,
    hasActiveDiscount: Boolean(activeDiscount),
    discountAmount,
    discountedPrice,
  };
};

// ==========================================
// PRODUCT ENRICHMENT
// ==========================================

export const enrichProducts = async (products) => {
  if (!products.length) {
    return [];
  }

  const productIds = products.map((product) => product.id);

  const [
    orderedQuantities,
    soldQuantities,
    reviewSummaries,
  ] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        order: {
          status: {
            in: ["PENDING", "CONFIRMED", "SHIPPED"],
          },
        },
      },
      _sum: { quantity: true },
    }),

    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        order: { status: "DELIVERED" },
      },
      _sum: { quantity: true },
    }),

    prisma.productReview.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const orderedMap = new Map(
    orderedQuantities.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  const soldMap = new Map(
    soldQuantities.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  const reviewMap = new Map(
    reviewSummaries.map((item) => [
      item.productId,
      {
        averageRating: Number(
          (item._avg.rating || 0).toFixed(1)
        ),
        totalReviews: item._count.rating,
      },
    ])
  );

  const now = new Date();
  const newArrivalCutoff = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  return products.map((product) => {
    const pricing = calculateProductPricing(product);

    const review = reviewMap.get(product.id) || {
      averageRating: 0,
      totalReviews: 0,
    };

    const ordered = orderedMap.get(product.id) || 0;
    const sold = soldMap.get(product.id) || 0;

    return {
      ...product,
      price: Number(product.price),
      discount: pricing.discount,
      productDiscount: product.discount,
      hasActiveDiscount: pricing.hasActiveDiscount,
      discountAmount: pricing.discountAmount,
      discountedPrice: pricing.discountedPrice,
      isNewArrival: product.createdAt >= newArrivalCutoff,
      stockInfo: {
        available: product.stock,
        ordered,
        sold,
      },
      reviews: {
        averageRating: review.averageRating,
        totalReviews: review.totalReviews,
      },
      averageRating: review.averageRating,
      totalReviews: review.totalReviews,
    };
  });
};

// ==========================================
// SHOP OWNER HELPERS
// ==========================================

const getActiveShop = async (userId) => {
  const parsedUserId = Number(userId);

  if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
    throw createError("Invalid user ID", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: parsedUserId },
    select: {
      id: true,
      role: true,
      isActive: true,
      shop: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw createError("User not found or inactive", 403);
  }

  if (user.role !== "SHOP_OWNER") {
    throw createError(
      "Only Shop Owners can manage products",
      403
    );
  }

  if (!user.shop) {
    throw createError("Shop not found", 404);
  }

  if (user.shop.status !== "ACTIVE") {
    throw createError("Your shop is deactivated.", 403);
  }

  return user.shop;
};

// ==========================================
// VERIFY SHOP OWNER PRODUCT OWNERSHIP
// ==========================================

const getOwnedShopProduct = async (
  tx,
  shopId,
  productId
) => {
  const product = await tx.product.findFirst({
    where: {
      id: validateProductId(productId),
      shopId: validateShopId(shopId),
    },
    include: productInclude,
  });

  if (!product) {
    throw createError("Product not found in your shop", 404);
  }

  return product;
};

// ==========================================
// VALIDATE SHOP STATUS
// ==========================================

const validateActiveShop = async (shopId) => {
  const parsedShopId = validateShopId(shopId);

  const shop = await prisma.shop.findUnique({
    where: { id: parsedShopId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!shop) {
    throw createError("Shop not found", 404);
  }

  if (shop.status !== "ACTIVE") {
    throw createError("Your shop is deactivated.", 403);
  }

  return shop;
};

// ==========================================
// PRODUCT CATEGORY INPUT
// ==========================================

const getProductCategoryInput = (data) => {
  return data.productCategoryId ?? data.categoryId;
};

// ==========================================
// 1. CREATE PRODUCT
// SHOP OWNER ONLY
// ==========================================

export const createProduct = async (data, options = {}) => {
  const { shopId = null } = options;

  if (!shopId) {
    throw createError(
      "A shop is required to create a product",
      400
    );
  }

  const parsedShopId = validateShopId(shopId);

  await validateActiveShop(parsedShopId);

  const categoryId = await validateProductCategory(
    parsedShopId,
    getProductCategoryInput(data)
  );

  const images = validateProductImages(data.images ?? []);

  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      stock: data.stock,
      shop: {
        connect: { id: parsedShopId },
      },
      productCategory: {
        connect: {
          id_shopId: {
            id: categoryId,
            shopId: parsedShopId,
          },
        },
      },
      images,
      isFeatured: false,
      status: "ACTIVE",
    },
    include: productInclude,
  });

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};

// ==========================================
// 2. GET ALL PRODUCTS
// PUBLIC MARKETPLACE DISCOVERY
// ==========================================


export const getAllProducts = async (
  search,
  categoryId,
  options = {}
) => {
  const {
    page = 1,
    limit = 12,
    sortBy = "newest",
    featured,
  } = options;

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(limit) || 12)
  );

  const skip = (currentPage - 1) * pageSize;

  const where = {
    status: "ACTIVE",
    shop: {
      is: {
        status: "ACTIVE",
      },
    },
  };

  // Search by product name, description, shop name,
  // or product category name.
  if (search && String(search).trim()) {
    const searchTerm = String(search).trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        shop: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
      {
        productCategory: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  // Keep the exact product category filter.
  if (
    categoryId !== undefined &&
    categoryId !== null &&
    categoryId !== ""
  ) {
    where.productCategoryId = validateCategoryId(categoryId);
  }

  if (featured !== undefined && featured !== null && featured !== "") {
    if (featured === true || featured === "true") {
      where.isFeatured = true;
    } else if (featured === false || featured === "false") {
      where.isFeatured = false;
    } else {
      throw createError("Invalid featured filter", 400);
    }
  }

  // Keep all existing sorting options.
  const sortOptions = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    price_asc: { price: "asc" },
    price_desc: { price: "desc" },
    name_asc: { name: "asc" },
    name_desc: { name: "desc" },
  };

  const orderBy = sortOptions[sortBy];

  if (!orderBy) {
    throw createError("Invalid product sorting option", 400);
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: productInclude,
    }),

    prisma.product.count({
      where,
    }),
  ]);

  const enrichedProducts = await enrichProducts(products);

  return {
    products: enrichedProducts,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: currentPage * pageSize < total,
      hasPreviousPage: currentPage > 1,
    },
  };
};



// ==========================================
// 3. GET PRODUCTS BY SHOP CATEGORY
// PUBLIC CUSTOMER CATEGORY DETAILS
// ==========================================

export const getProductsByShopCategory = async (
  shopCategoryId,
  filters = {}
) => {
  const parsedCategoryId = validateShopCategoryId(shopCategoryId);

  const {
    search,
    subcategory,
    page = 1,
    limit = 12,
    sortBy = "newest",
  } = filters;

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 12));
  const skip = (currentPage - 1) * pageSize;

  const category = await prisma.shopCategory.findUnique({
    where: { id: parsedCategoryId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!category) {
    throw createError("Shop category not found", 404);
  }

  const shopFilter = {
    status: "ACTIVE",
    shopCategoryId: parsedCategoryId,
  };

  const productCategories = await prisma.productCategory.findMany({
    where: {
      shop: { is: shopFilter },
    },
    select: {
      name: true,
      shopId: true,
    },
    orderBy: { name: "asc" },
  });

  const subcategoryMap = new Map();

  for (const productCategory of productCategories) {
    const displayName = productCategory.name.trim();

    if (!displayName) continue;

    const normalizedName = displayName.toLowerCase();

    if (!subcategoryMap.has(normalizedName)) {
      subcategoryMap.set(normalizedName, {
        name: displayName,
        shopIds: new Set(),
      });
    }

    subcategoryMap.get(normalizedName).shopIds.add(
      productCategory.shopId
    );
  }

  const subcategories = Array.from(subcategoryMap.values())
    .map(({ name, shopIds }) => ({
      name,
      shopCount: shopIds.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const where = {
    status: "ACTIVE",
    shop: { is: shopFilter },
  };

  if (search && String(search).trim()) {
    const searchTerm = String(search).trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
    ];
  }

  if (
    subcategory !== undefined &&
    subcategory !== null &&
    String(subcategory).trim()
  ) {
    where.productCategory = {
      is: {
        name: {
          equals: String(subcategory).trim(),
          mode: "insensitive",
        },
      },
    };
  }

  const sortOptions = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    price_asc: { price: "asc" },
    price_desc: { price: "desc" },
    name_asc: { name: "asc" },
    name_desc: { name: "desc" },
  };

  const orderBy = sortOptions[sortBy];

  if (!orderBy) {
    throw createError("Invalid product sorting option", 400);
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: productInclude,
    }),
    prisma.product.count({ where }),
  ]);

  const enrichedProducts = await enrichProducts(products);

  return {
    category,
    subcategories,
    products: enrichedProducts,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: currentPage * pageSize < total,
      hasPreviousPage: currentPage > 1,
    },
  };
};

// ==========================================
// 4. ADMIN PRODUCT MANAGEMENT
// GET ALL PRODUCTS
// Requires VIEW_PRODUCTS
// ==========================================

export const getAdminProducts = async (
  filters = {},
  actorId
) => {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    shopId,
    source = "ALL",
    isFeatured,
    sortBy = "newest",
  } = filters;

  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (currentPage - 1) * pageSize;

  const where = {};

  if (search && String(search).trim()) {
    const searchTerm = String(search).trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        shop: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  if (
    categoryId !== undefined &&
    categoryId !== null &&
    categoryId !== ""
  ) {
    where.productCategoryId = validateCategoryId(categoryId);
  }

  if (shopId !== undefined && shopId !== null && shopId !== "") {
    where.shopId = validateShopId(shopId);
  }

  if (source !== "ALL" && source !== "SHOP") {
    throw createError("Invalid product source filter", 400);
  }

  if (isFeatured !== undefined) {
    if (typeof isFeatured !== "boolean") {
      throw createError("Invalid featured filter", 400);
    }

    where.isFeatured = isFeatured;
  }

  const sortOptions = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    price_asc: { price: "asc" },
    price_desc: { price: "desc" },
    name_asc: { name: "asc" },
    name_desc: { name: "desc" },
  };

  const orderBy = sortOptions[sortBy];

  if (!orderBy) {
    throw createError("Invalid product sorting option", 400);
  }

  const adminProductInclude = {
    ...productInclude,
    shop: {
      select: {
        id: true,
        name: true,
        status: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  };

  const { products, total } = await prisma.$transaction(
    async (tx) => {
      await validateAdminProductPermission(
        tx,
        actorId,
        "VIEW_PRODUCTS"
      );

      const [foundProducts, count] = await Promise.all([
        tx.product.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
          include: adminProductInclude,
        }),
        tx.product.count({ where }),
      ]);

      return {
        products: foundProducts,
        total: count,
      };
    }
  );

  const enrichedProducts = await enrichProducts(products);

  return {
    products: enrichedProducts,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: currentPage * pageSize < total,
      hasPreviousPage: currentPage > 1,
    },
  };
};

// ==========================================
// 5. GET PRODUCT BY ID
// PUBLIC PRODUCT DETAILS
// ==========================================

export const getProductById = async (id) => {
  const productId = validateProductId(id);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      shop: { status: "ACTIVE" },
    },
    include: productInclude,
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};

// ==========================================
// 6. UPDATE PRODUCT
// SHOP OWNER ONLY
// ==========================================


export const updateProduct = async (id, data, options = {}) => {
  const productId = validateProductId(id);
  const { shopId } = options;

  if (!shopId) {
    throw createError(
      "Only the Shop Owner can update product details",
      403
    );
  }

  const parsedShopId = validateShopId(shopId);

  await validateActiveShop(parsedShopId);

  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: parsedShopId,
    },
  });

  if (!existingProduct) {
    throw createError("Product not found in your shop", 404);
  }

  const updateData = {};

  // PRODUCT INFORMATION

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  if (data.price !== undefined) {
    updateData.price = data.price;
  }

  if (data.stock !== undefined) {
    updateData.stock = data.stock;
  }

  // PRODUCT IMAGES

  if (data.retainedImages !== undefined) {
    const requestedRetainedImages = parseRetainedImages(
      data.retainedImages
    );

    const existingImages = existingProduct.images || [];

    // A Shop Owner may retain only images already belonging
    // to this particular product.
    const invalidImages = requestedRetainedImages.some(
      (image) =>
        typeof image !== "string" ||
        !existingImages.includes(image)
    );

    if (invalidImages) {
      throw createError(
        "One or more retained images are invalid",
        400
      );
    }

    const retainedImages = validateProductImages(
      requestedRetainedImages
    );

    const newImages = validateProductImages(data.images ?? []);

    updateData.images = validateProductImages([
      ...retainedImages,
      ...newImages,
    ]);
  } else if (data.images !== undefined) {
    // Preserve the existing replacement behavior when the
    // caller explicitly supplies images without retainedImages.
    updateData.images = validateProductImages(data.images);
  }

  // PRODUCT CATEGORY

  const categoryInput = getProductCategoryInput(data);

  if (categoryInput !== undefined) {
    const categoryId = await validateProductCategory(
      parsedShopId,
      categoryInput
    );

    updateData.productCategory = {
      connect: {
        id_shopId: {
          id: categoryId,
          shopId: parsedShopId,
        },
      },
    };
  }

  if (Object.keys(updateData).length === 0) {
    throw createError(
      "No valid product information was provided",
      400
    );
  }

  const updatedProduct = await prisma.product.update({
    where: {
      id: productId,
    },
    data: updateData,
    include: productInclude,
  });

  const [enrichedProduct] = await enrichProducts([
    updatedProduct,
  ]);

  return enrichedProduct;
};


// ==========================================
// 7. DELETE PRODUCT
// SHOP OWNER ONLY
// ==========================================

export const deleteProduct = async (id, options = {}) => {
  const productId = validateProductId(id);
  const { shopId = null } = options;

  if (!shopId) {
    throw createError(
      "Only Shop Owners can permanently delete products through this service.",
      403
    );
  }

  const parsedShopId = validateShopId(shopId);

  await validateActiveShop(parsedShopId);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: parsedShopId,
    },
  });

  if (!product) {
    throw createError("Product not found in your shop", 404);
  }

  const [orderItemsCount, cartItemsCount] = await Promise.all([
    prisma.orderItem.count({ where: { productId } }),
    prisma.cartItem.count({ where: { productId } }),
  ]);

  if (orderItemsCount > 0) {
    throw createError(
      "This product has order history and cannot be permanently deleted.",
      409
    );
  }

  if (cartItemsCount > 0) {
    throw createError(
      "This product is currently referenced in customer carts. Remove it from those carts before deleting it.",
      409
    );
  }

  try {
    await prisma.product.delete({
      where: { id: productId },
    });

    return {
      message: "Product deleted successfully",
      productId,
    };
  } catch (error) {
    if (error.code === "P2003" || error.code === "P2014") {
      throw createError(
        "This product is associated with existing records and cannot be deleted.",
        409
      );
    }

    throw error;
  }
};

// ==========================================
// 8. GET FEATURED PRODUCTS
// PUBLIC
// ==========================================

export const getFeaturedProducts = async (limit = 8) => {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 8));

  const products = await prisma.product.findMany({
    where: {
      isFeatured: true,
      status: "ACTIVE",
      shop: { status: "ACTIVE" },
    },
    take: pageSize,
    orderBy: { createdAt: "desc" },
    include: productInclude,
  });

  return enrichProducts(products);
};

// ==========================================
// 9. GET NEW ARRIVALS
// PUBLIC
// ==========================================

export const getNewArrivals = async (limit = 8) => {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 8));

  const cutoffDate = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      createdAt: { gte: cutoffDate },
      shop: { status: "ACTIVE" },
    },
    take: pageSize,
    orderBy: { createdAt: "desc" },
    include: productInclude,
  });

  return enrichProducts(products);
};

// ==========================================
// 10. GET BEST-SELLING PRODUCTS
// PUBLIC
// ==========================================

export const getBestSellingProducts = async (limit = 8) => {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 8));

  const bestSelling = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
     status: { notIn: ["CANCELLED", "PENDING"],
    },
    },
      product: {
        status: "ACTIVE",
        shop: { status: "ACTIVE" },
      },
    },
    _sum: { quantity: true },
    orderBy: {
      _sum: { quantity: "desc" },
    },
    take: pageSize,
  });

  if (!bestSelling.length) return [];

  const productIds = bestSelling.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: "ACTIVE",
      shop: { status: "ACTIVE" },
    },
    include: productInclude,
  });

  const productMap = new Map(
    products.map((product) => [product.id, product])
  );

  const orderedProducts = productIds
    .map((id) => productMap.get(id))
    .filter(Boolean);

  const enrichedProducts = await enrichProducts(orderedProducts);

  const soldMap = new Map(
    bestSelling.map((item) => [
      item.productId,
      item._sum.quantity || 0,
    ])
  );

  return enrichedProducts.map((product) => ({
    ...product,
    stockInfo: {
      ...product.stockInfo,
      sold: soldMap.get(product.id) || 0,
    },
  }));
};

// ==========================================
// 11. SHOP OWNER: FEATURE / UNFEATURE PRODUCT
// ==========================================

export const setShopProductFeatured = async (
  userId,
  id,
  isFeatured
) => {
  const productId = validateProductId(id);

  if (typeof isFeatured !== "boolean") {
    throw createError("isFeatured must be a boolean", 400);
  }

  const shop = await getActiveShop(userId);

  const updatedProduct = await prisma.$transaction(async (tx) => {
    const existingProduct = await getOwnedShopProduct(
      tx,
      shop.id,
      productId
    );

    const product = await tx.product.update({
      where: { id: productId },
      data: { isFeatured },
      include: productInclude,
    });

    if (!existingProduct.isFeatured && isFeatured) {
      await notifyAllCustomers(
        {
          type: "FEATURED_PRODUCT",
          title: "New Featured Product!",
          message: `Check out ${product.name}, now featured on ShopEase.`,
          productId: product.id,
          link: `/products/${product.id}`,
        },
        tx
      );
    }

    return product;
  });

  const [enrichedProduct] = await enrichProducts([updatedProduct]);

  return enrichedProduct;
};

// ==========================================
// 12. ADMIN PRODUCT ACTIVATION / DEACTIVATION
// ==========================================

export const setProductStatus = async (
  id,
  status,
  actor
) => {
  const productId = validateProductId(id);

  const allowedStatuses = [
    "ACTIVE",
    "ADMIN_DEACTIVATED",
  ];

  if (!allowedStatuses.includes(status)) {
    throw createError("Invalid product status", 400);
  }

  const updatedProduct = await prisma.$transaction(async (tx) => {
    await validateProductStatusPermission(tx, actor, status);

    const existingProduct = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw createError("Product not found", 404);
    }

    return tx.product.update({
      where: { id: productId },
      data: { status },
      include: productInclude,
    });
  });

  const [enrichedProduct] = await enrichProducts([updatedProduct]);

  return {
    message:
      status === "ACTIVE"
        ? "Product activated successfully"
        : "Product deactivated successfully",
    data: enrichedProduct,
  };
};

// ==========================================
// 13. SHOP OWNER: CREATE / UPDATE DISCOUNT
// ==========================================

export const setShopProductDiscount = async (
  userId,
  id,
  data
) => {
  const productId = validateProductId(id);

  if (!data || typeof data !== "object") {
    throw createError("Invalid discount information", 400);
  }

  const shop = await getActiveShop(userId);

  const result = await prisma.$transaction(async (tx) => {
    const product = await getOwnedShopProduct(
      tx,
      shop.id,
      productId
    );

    if (!["PERCENTAGE", "FIXED"].includes(data.type)) {
      throw createError("Invalid discount type", 400);
    }

    const value = Number(data.value);

    if (!Number.isFinite(value) || value <= 0) {
      throw createError(
        "Discount value must be greater than 0",
        400
      );
    }

    const originalPrice = Number(product.price);

    if (data.type === "PERCENTAGE" && value > 100) {
      throw createError(
        "Percentage discount cannot exceed 100%",
        400
      );
    }

    if (data.type === "FIXED" && value >= originalPrice) {
      throw createError(
        "Fixed discount must be less than the product price",
        400
      );
    }

    const startsAt =
      data.startsAt === undefined || data.startsAt === null
        ? null
        : new Date(data.startsAt);

    const endsAt =
      data.endsAt === undefined || data.endsAt === null
        ? null
        : new Date(data.endsAt);

    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw createError("Invalid discount start date", 400);
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw createError("Invalid discount end date", 400);
    }

    if (startsAt && endsAt && endsAt <= startsAt) {
      throw createError(
        "Discount end date must be after start date",
        400
      );
    }

    if (
      data.isActive !== undefined &&
      typeof data.isActive !== "boolean"
    ) {
      throw createError("isActive must be a boolean", 400);
    }

    const isActive = data.isActive ?? true;

    const existingDiscount = await tx.productDiscount.findUnique({
      where: { productId },
    });

    const wasActive = isDiscountCurrentlyActive(existingDiscount);

    const updatedDiscount = await tx.productDiscount.upsert({
      where: { productId },
      update: {
        type: data.type,
        value: value.toFixed(2),
        startsAt,
        endsAt,
        isActive,
      },
      create: {
        productId,
        type: data.type,
        value: value.toFixed(2),
        startsAt,
        endsAt,
        isActive,
      },
    });

    const isNowActive = isDiscountCurrentlyActive(updatedDiscount);

    if (!wasActive && isNowActive) {
      const discountText =
        updatedDiscount.type === "PERCENTAGE"
          ? `${Number(updatedDiscount.value)}% OFF`
          : `ETB ${Number(updatedDiscount.value).toFixed(2)} OFF`;

      await notifyAllCustomers(
        {
          type: "NEW_DISCOUNT",
          title: "Special Discount Available!",
          message: `Get ${discountText} on ${product.name}. Shop now!`,
          productId: product.id,
          link: `/products/${product.id}`,
        },
        tx
      );
    }

    return updatedDiscount;
  });

  return {
    message: "Product discount saved successfully",
    data: result,
  };
};

// ==========================================
// 14. SHOP OWNER: REMOVE OWN PRODUCT DISCOUNT
// ==========================================

export const removeShopProductDiscount = async (
  userId,
  id
) => {
  const productId = validateProductId(id);
  const shop = await getActiveShop(userId);

  await prisma.$transaction(async (tx) => {
    await getOwnedShopProduct(tx, shop.id, productId);

    const discount = await tx.productDiscount.findUnique({
      where: { productId },
    });

    if (!discount) {
      throw createError("Product discount not found", 404);
    }

    await tx.productDiscount.delete({
      where: { productId },
    });
  });

  return {
    message: "Product discount removed successfully",
  };
};

// ==========================================
// 15. GET MY SHOP PRODUCTS
// ==========================================

export const getMyShopProducts = async (
  userId,
  search,
  categoryId,
  options = {}
) => {
  const shop = await getActiveShop(userId);

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(options.limit) || 10)
  );

  const skip = (page - 1) * limit;

  const where = { shopId: shop.id };

  if (search && String(search).trim()) {
    const searchTerm = String(search).trim();

    where.OR = [
      {
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
    ];
  }

  if (
    categoryId !== undefined &&
    categoryId !== null &&
    categoryId !== ""
  ) {
    where.productCategoryId = validateCategoryId(categoryId);
  }

  let orderBy = { createdAt: "desc" };

  switch (options.sortBy) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "price":
      orderBy = { price: "asc" };
      break;
    case "name":
      orderBy = { name: "asc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
  }

  // No status filter here:
  // Owners must still see ADMIN_DEACTIVATED products.

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const enrichedProducts = await enrichProducts(products);

  return {
    products: enrichedProducts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ==========================================
// 16. GET MY SHOP PRODUCT BY ID
// ==========================================

export const getMyShopProductById = async (
  userId,
  productId
) => {
  const shop = await getActiveShop(userId);
  const parsedProductId = validateProductId(productId);

  const product = await prisma.product.findFirst({
    where: {
      id: parsedProductId,
      shopId: shop.id,
    },
    include: productInclude,
  });

  if (!product) {
    throw createError("Product not found in your shop", 404);
  }

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};

// ==========================================
// 17. CREATE SHOP PRODUCT
// ==========================================

export const createShopProduct = async (userId, data) => {
  const shop = await getActiveShop(userId);

  return createProduct(data, {
    shopId: shop.id,
  });
};

// ==========================================
// 18. UPDATE SHOP PRODUCT
// ==========================================

export const updateShopProduct = async (
  userId,
  productId,
  data
) => {
  const shop = await getActiveShop(userId);

  return updateProduct(productId, data, {
    shopId: shop.id,
  });
};

// ==========================================
// 19. DELETE SHOP PRODUCT
// ==========================================

export const deleteShopProduct = async (
  userId,
  productId
) => {
  const shop = await getActiveShop(userId);

  return deleteProduct(productId, {
    shopId: shop.id,
  });
};

// ==========================================
// 20. GET ADMIN PRODUCT BY ID
// Requires VIEW_PRODUCTS
// ==========================================

export const getAdminProductById = async (
  id,
  actorId
) => {
  const productId = validateProductId(id);

  const product = await prisma.$transaction(async (tx) => {
    await validateAdminProductPermission(
      tx,
      actorId,
      "VIEW_PRODUCTS"
    );

    return tx.product.findUnique({
      where: { id: productId },
      include: {
        productCategory: true,
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            status: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        discount: true,
      },
    });
  });

  if (!product) {
    throw createError("Product not found.", 404);
  }

  const [enrichedProduct] = await enrichProducts([product]);

  return enrichedProduct;
};
