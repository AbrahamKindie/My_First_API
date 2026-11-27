
import {
  createReview,
  getProductReviews,
  updateReview,
  getMyShopReviews,
} from "../services/reviewServices.js";

// Create review
export const createReviewController = async (req, res) => {
  try {
    const review = await createReview(
      req.user.userId,
      req.params.productId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

// Get product reviews
export const getProductReviewsController = async (req, res) => {
  try {
    const result = await getProductReviews(
      req.params.productId,
      req.query.page,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Product reviews retrieved successfully",
      data: result.reviews,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get product reviews error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

// Update own review
export const updateReviewController = async (req, res) => {
  try {
    const review = await updateReview(
      req.user.userId,
      req.params.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    console.error("Update review error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};


export const getMyShopReviewsController = async (req, res) => {
  try {
    const result = await getMyShopReviews(
      req.user.userId,
      req.query.page,
      req.query.limit
    );

    return res.status(200).json({
      success: true,
      message: "Shop reviews retrieved successfully",
      shop: result.shop,
      data: result.reviews,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get shop reviews error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

