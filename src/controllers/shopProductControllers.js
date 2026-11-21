
import fs from "node:fs/promises";
import path from "node:path";

import {
  getMyShopProducts,
  getMyShopProductById,
  createShopProduct,
  updateShopProduct,
  deleteShopProduct,
  setShopProductFeatured,
  setShopProductDiscount,
  removeShopProductDiscount,
} from "../services/productService.js";

// ==========================================
// COMMON ERROR HANDLER
// ==========================================

const handleControllerError = (res, error, context) => {
  console.error(`\n${context}:`);
  console.error(error);

  const isProduction = process.env.NODE_ENV === "production";

  return res.status(error.statusCode || 500).json({
    success: false,
    message: isProduction
      ? error.statusCode
        ? error.message
        : "Internal server error"
      : error.message || "Internal server error",
    ...(!isProduction && {
      stack: error.stack,
    }),
  });
};

// ==========================================
// REQUEST VALIDATION HELPERS
// ==========================================

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// Convert multipart numeric fields into validated numbers.
// For updates, only validate fields that were submitted.

const normalizeNumericFields = (data, { partial = false } = {}) => {
  const normalized = { ...data };

  if (!partial || Object.hasOwn(data, "price")) {
    if (
      data.price === undefined ||
      data.price === null ||
      String(data.price).trim() === ""
    ) {
      throw createValidationError("Product price is required");
    }

    const price = Number(data.price);

    if (!Number.isFinite(price) || price <= 0) {
      throw createValidationError(
        "Product price must be a valid number greater than zero"
      );
    }

    normalized.price = price;
  }

  if (!partial || Object.hasOwn(data, "stock")) {
    if (
      data.stock === undefined ||
      data.stock === null ||
      String(data.stock).trim() === ""
    ) {
      throw createValidationError("Product stock is required");
    }

    const stock = Number(data.stock);

    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw createValidationError(
        "Product stock must be a non-negative whole number"
      );
    }

    normalized.stock = stock;
  }

  return normalized;
};

// Parse retainedImages sent by the frontend as JSON in FormData.

const parseRetainedImages = (value) => {
  let images = value;

  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      throw createValidationError(
        "Invalid retained images format"
      );
    }
  }

  if (!Array.isArray(images)) {
    throw createValidationError(
      "Retained images must be an array"
    );
  }

  return images;
};

// ==========================================
// UPLOADED IMAGE CLEANUP
// ==========================================

const cleanupUploadedImages = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  const uploadDirectory = path.resolve(
    process.cwd(),
    "uploads",
    "products"
  );

  const cleanupResults = await Promise.allSettled(
    files.map(async (file) => {
      if (!file?.filename) return;

      const filename = path.basename(file.filename);

      if (filename !== file.filename) return;

      await fs.unlink(
        path.join(uploadDirectory, filename)
      );
    })
  );

  cleanupResults.forEach((result) => {
    if (
      result.status === "rejected" &&
      result.reason?.code !== "ENOENT"
    ) {
      console.error(
        "Failed to clean up uploaded product image:",
        result.reason
      );
    }
  });
};

// ==========================================
// 1. GET MY SHOP PRODUCTS
// ==========================================

export const getMyShopProductsController = async (req, res) => {
  try {
    const {
      search,
      categoryId,
      page,
      limit,
      sortBy,
    } = req.query;

    const result = await getMyShopProducts(
      req.user.userId,
      search,
      categoryId,
      { page, limit, sortBy }
    );

    return res.status(200).json({
      success: true,
      message: "Shop products retrieved successfully",
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET MY SHOP PRODUCTS ERROR"
    );
  }
};

// ==========================================
// 2. GET MY SHOP PRODUCT BY ID
// ==========================================

export const getMyShopProductByIdController = async (req, res) => {
  try {
    const product = await getMyShopProductById(
      req.user.userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Shop product retrieved successfully",
      data: product,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET MY SHOP PRODUCT BY ID ERROR"
    );
  }
};

// ==========================================
// 3. CREATE SHOP PRODUCT
// ==========================================

export const createShopProductController = async (req, res) => {
  try {
    const productData = normalizeNumericFields(
      req.body || {}
    );

    const images =
      req.files?.map(
        (file) => `/uploads/products/${file.filename}`
      ) || [];

    const product = await createShopProduct(
      req.user.userId,
      {
        ...productData,
        images,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Shop product created successfully",
      data: product,
    });
  } catch (error) {
    await cleanupUploadedImages(req.files);

    return handleControllerError(
      res,
      error,
      "CREATE SHOP PRODUCT ERROR"
    );
  }
};

// ==========================================
// 4. UPDATE SHOP PRODUCT
// ==========================================

export const updateShopProductController = async (req, res) => {
  try {
    let productData = normalizeNumericFields(
      req.body || {},
      { partial: true }
    );

    // Parse retained images submitted by EditProduct.jsx.
    if (Object.hasOwn(productData, "retainedImages")) {
      productData.retainedImages = parseRetainedImages(
        productData.retainedImages
      );
    }

    // Add paths for newly uploaded images.
    if (req.files?.length > 0) {
      productData.images = req.files.map(
        (file) => `/uploads/products/${file.filename}`
      );
    }

    const product = await updateShopProduct(
      req.user.userId,
      req.params.id,
      productData
    );

    return res.status(200).json({
      success: true,
      message: "Shop product updated successfully",
      data: product,
    });
  } catch (error) {
    await cleanupUploadedImages(req.files);

    return handleControllerError(
      res,
      error,
      "UPDATE SHOP PRODUCT ERROR"
    );
  }
};

// ==========================================
// 5. DELETE SHOP PRODUCT
// ==========================================

export const deleteShopProductController = async (req, res) => {
  try {
    const result = await deleteShopProduct(
      req.user.userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "DELETE SHOP PRODUCT ERROR"
    );
  }
};

// ==========================================
// 6. FEATURE / UNFEATURE OWN PRODUCT
// ==========================================

export const setShopProductFeaturedController = async (
  req,
  res
) => {
  try {
    const product = await setShopProductFeatured(
      req.user.userId,
      req.params.id,
      req.body.isFeatured
    );

    return res.status(200).json({
      success: true,
      message: "Product featured status updated successfully",
      data: product,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "SET SHOP PRODUCT FEATURED ERROR"
    );
  }
};

// ==========================================
// 7. CREATE / UPDATE OWN PRODUCT DISCOUNT
// ==========================================

export const setShopProductDiscountController = async (
  req,
  res
) => {
  try {
    const result = await setShopProductDiscount(
      req.user.userId,
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "SET SHOP PRODUCT DISCOUNT ERROR"
    );
  }
};

// ==========================================
// 8. REMOVE OWN PRODUCT DISCOUNT
// ==========================================

export const removeShopProductDiscountController = async (
  req,
  res
) => {
  try {
    const result = await removeShopProductDiscount(
      req.user.userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "REMOVE SHOP PRODUCT DISCOUNT ERROR"
    );
  }
};
