
import {
  getAllCategories,
  getCategoryById,
} from "../services/categoryService.js";

// ==========================================
// PUBLIC SHOP CATEGORY CONTROLLERS
// STOREFRONT + SHOP OWNER REGISTRATION
// ==========================================

// GET ALL SHOP CATEGORIES
export const getAllCategoriesController = async (req, res, next) => {
  try {
    const categories = await getAllCategories();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// GET SHOP CATEGORY BY ID
export const getCategoryByIdController = async (req, res, next) => {
  try {
    const category = await getCategoryById(req.params.id);

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};
