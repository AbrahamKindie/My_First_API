
import {
  createProduct,
  updateProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
  getFeaturedProducts,
  getBestSellingProducts,
  getNewArrivals,
  setProductFeatured,
  setProductDiscount,
  removeProductDiscount,
} from "../services/productService.js";

// ============================================
// 1. CREATE PRODUCT
// ============================================

export const createProductController = async (req, res) => {
  try {
    const product = await createProduct(req.body);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 2. GET ALL PRODUCTS
// ============================================

export const getAllProductsController = async (req, res) => {
  try {
    const {
      search,
      categoryId,
      page = 1,
      limit = 12,
      sortBy = "newest",
      featured,
    } = req.query;

    let featuredFilter;

    if (featured !== undefined) {
      if (featured !== "true" && featured !== "false") {
        return res.status(400).json({
          success: false,
          message: "featured must be true or false",
        });
      }

      featuredFilter = featured === "true";
    }

    const products = await getAllProducts(
      search,
      categoryId === undefined ? undefined : Number(categoryId),
      {
        page: Number(page),
        limit: Number(limit),
        sortBy,
        featured: featuredFilter,
      }
    );

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: Math.min(100, Math.max(1, Number(limit) || 12)),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 3. GET PRODUCT BY ID
// ============================================

export const getProductByIdController = async (req, res) => {
  try {
    const product = await getProductById(Number(req.params.id));

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 4. UPDATE PRODUCT
// ============================================

export const updateProductController = async (req, res) => {
  try {
    const product = await updateProduct(
      Number(req.params.id),
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 5. DELETE PRODUCT
// ============================================

export const deleteProductController = async (req, res) => {
  try {
    const product = await deleteProduct(Number(req.params.id));

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 6. GET FEATURED PRODUCTS
// ============================================

export const getFeaturedProductsController = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;

    const products = await getFeaturedProducts(limit);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 7. GET BEST-SELLING PRODUCTS
// ============================================

export const getBestSellingProductsController = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;

    const products = await getBestSellingProducts(limit);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 8. GET NEW ARRIVALS
// ============================================

export const getNewArrivalsController = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;

    const products = await getNewArrivals(limit);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 9. SET PRODUCT FEATURED STATUS
// ============================================

export const setProductFeaturedController = async (req, res) => {
  try {
    const { isFeatured } = req.body;

    const product = await setProductFeatured(
      Number(req.params.id),
      isFeatured
    );

    return res.status(200).json({
      success: true,
      message: isFeatured
        ? "Product marked as featured successfully"
        : "Product removed from featured products successfully",
      data: product,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 10. CREATE OR UPDATE PRODUCT DISCOUNT
// ============================================

export const setProductDiscountController = async (req, res) => {
  try {
    const discount = await setProductDiscount(
      Number(req.params.id),
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Product discount saved successfully",
      data: discount,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================================
// 11. REMOVE PRODUCT DISCOUNT
// ============================================

export const removeProductDiscountController = async (req, res) => {
  try {
    const discount = await removeProductDiscount(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Product discount removed successfully",
      data: discount,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
