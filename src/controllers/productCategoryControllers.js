
import {
  createProductCategory,
  getMyProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
} from "../services/productCategoryServices.js";

// ============================================
// CREATE PRODUCT CATEGORY
// ============================================

export const createProductCategoryController = async (req, res) => {
  try {
    const category = await createProductCategory(
      req.shopId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Product category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create product category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && {
        errors: error.details,
      }),
    });
  }
};

// ============================================
// GET MY PRODUCT CATEGORIES
// Includes assigned product names
// ============================================

export const getMyProductCategoriesController = async (req, res) => {
  try {
    const categories = await getMyProductCategories(
      req.shopId
    );

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get product categories error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && {
        errors: error.details,
      }),
    });
  }
};

// ============================================
// GET PRODUCT CATEGORY BY ID
// Includes assigned products and stock details
// ============================================

export const getProductCategoryByIdController = async (req, res) => {
  try {
    const category = await getProductCategoryById(
      req.shopId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get product category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && {
        errors: error.details,
      }),
    });
  }
};

// ============================================
// UPDATE PRODUCT CATEGORY
// ============================================

export const updateProductCategoryController = async (req, res) => {
  try {
    const category = await updateProductCategory(
      req.shopId,
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Product category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update product category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && {
        errors: error.details,
      }),
    });
  }
};

// ============================================
// DELETE PRODUCT CATEGORY
// ============================================

export const deleteProductCategoryController = async (req, res) => {
  try {
    const result = await deleteProductCategory(
      req.shopId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete product category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && {
        errors: error.details,
      }),
    });
  }
};
