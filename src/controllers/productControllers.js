
import {
  getAllProducts,
  getProductsByShopCategory,
  getAdminProducts,
  getProductById,
  setProductStatus,
  getFeaturedProducts,
  getBestSellingProducts,
  getNewArrivals,
  getAdminProductById,
} from "../services/productService.js";

import {
  likeProduct,
  unlikeProduct,
  getProductLikes,
  getMyLikedProducts,
  reportProduct,
  getMyProductReports,
  getAllProductReports,
  reviewProductReport,
} from "../services/productInteractionServices.js";

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
// PUBLIC PRODUCT DISCOVERY
// ==========================================
export const getAllProductsController = async (req, res) => {
  try {
    const {
      search,
      categoryId,
      page,
      limit,
      sortBy,
      featured,
    } = req.query;

    const products = await getAllProducts(
      search,
      categoryId,
      {
        page,
        limit,
        sortBy,
        featured,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: products,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET ALL PRODUCTS ERROR"
    );
  }
};

export const getProductsByShopCategoryController = async (
  req,
  res
) => {
  try {
    const {
      search,
      subcategory,
      page,
      limit,
      sortBy,
    } = req.query;

    const result = await getProductsByShopCategory(
      req.params.categoryId,
      { search, subcategory, page, limit, sortBy }
    );

    return res.status(200).json({
      success: true,
      message: "Shop category products retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET PRODUCTS BY SHOP CATEGORY ERROR"
    );
  }
};

// ==========================================
// ADMIN PRODUCT VIEWING
// ==========================================

export const getAdminProductsController = async (req, res) => {
  try {
    const result = await getAdminProducts(
      req.validatedQuery || {},
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Admin products retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET ADMIN PRODUCTS ERROR"
    );
  }
};

export const getAdminProductByIdController = async (req, res) => {
  try {
    const product = await getAdminProductById(
      req.params.id,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Admin product details retrieved successfully",
      data: product,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET ADMIN PRODUCT DETAILS ERROR"
    );
  }
};

// ==========================================
// PUBLIC PRODUCT DETAILS
// ==========================================

export const getProductByIdController = async (req, res) => {
  try {
    const product = await getProductById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET PRODUCT BY ID ERROR"
    );
  }
};

// ==========================================
// ADMIN PRODUCT ACTIVATION / DEACTIVATION
// ==========================================

export const setProductStatusController = async (req, res) => {
  try {
    const result = await setProductStatus(
      req.params.id,
      req.body.status,
      req.user
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
      "SET PRODUCT STATUS ERROR"
    );
  }
};

// ==========================================
// PUBLIC PRODUCT COLLECTIONS
// ==========================================

export const getFeaturedProductsController = async (req, res) => {
  try {
    const products = await getFeaturedProducts(req.query.limit);

    return res.status(200).json({
      success: true,
      message: "Featured products retrieved successfully",
      data: products,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET FEATURED PRODUCTS ERROR"
    );
  }
};

export const getBestSellingProductsController = async (req, res) => {
  try {
    const products = await getBestSellingProducts(req.query.limit);

    return res.status(200).json({
      success: true,
      message: "Best-selling products retrieved successfully",
      data: products,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET BEST SELLING PRODUCTS ERROR"
    );
  }
};

export const getNewArrivalsController = async (req, res) => {
  try {
    const products = await getNewArrivals(req.query.limit);

    return res.status(200).json({
      success: true,
      message: "New arrivals retrieved successfully",
      data: products,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET NEW ARRIVALS ERROR"
    );
  }
};

// ==========================================
// PRODUCT LIKES
// ==========================================

export const likeProductController = async (req, res) => {
  try {
    const result = await likeProduct(
      req.user.userId,
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleControllerError(res, error, "LIKE PRODUCT ERROR");
  }
};

export const unlikeProductController = async (req, res) => {
  try {
    const result = await unlikeProduct(
      req.user.userId,
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleControllerError(res, error, "UNLIKE PRODUCT ERROR");
  }
};

export const getProductLikesController = async (req, res) => {
  try {
    const result = await getProductLikes(
      Number(req.params.id),
      req.user?.userId || null
    );

    return res.status(200).json({
      success: true,
      message: "Product likes retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET PRODUCT LIKES ERROR"
    );
  }
};

export const getMyLikedProductsController = async (req, res) => {
  try {
    const products = await getMyLikedProducts(req.user.userId, {
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Liked products retrieved successfully",
      data: products,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET MY LIKED PRODUCTS ERROR"
    );
  }
};

// ==========================================
// PRODUCT REPORTS
// ==========================================

export const reportProductController = async (req, res) => {
  try {
    const result = await reportProduct(
      req.user.userId,
      Number(req.params.id),
      req.body
    );

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.report,
    });
  } catch (error) {
    return handleControllerError(res, error, "REPORT PRODUCT ERROR");
  }
};

export const getMyProductReportsController = async (req, res) => {
  try {
    const result = await getMyProductReports(req.user.userId, {
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Your product reports retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET MY PRODUCT REPORTS ERROR"
    );
  }
};

export const getAllProductReportsController = async (req, res) => {
  try {
    const result = await getAllProductReports({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      reason: req.query.reason,
      productId: req.query.productId,
      search: req.query.search,
    });

    return res.status(200).json({
      success: true,
      message: "Product reports retrieved successfully",
      data: result,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "GET ALL PRODUCT REPORTS ERROR"
    );
  }
};

export const reviewProductReportController = async (req, res) => {
  try {
    const result = await reviewProductReport(
      Number(req.params.reportId),
      req.user.userId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.report,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "REVIEW PRODUCT REPORT ERROR"
    );
  }
};
