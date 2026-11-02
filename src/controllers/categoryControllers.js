
import { createCategory, updateCategory, deleteCategory, getAllCategories, getCategoryById} from "../services/category.service.js";

// 1. Create Category
export const createCategoryController = async (req, res) => {
  try {
    const category = await createCategory(req.body);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && { errors: error.details }),
    });
  }
};

// 2. Get All Categories
export const getAllCategoriesController = async (req, res) => {
  try {
    const categories = await getAllCategories();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 3. Get Category By ID
export const getCategoryByIdController = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const category = await getCategoryById(id);

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category by ID error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};

// 4. Update Category
export const updateCategoryController = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const category = await updateCategory(id, req.body);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
      ...(error.details && { errors: error.details }),
    });
  }
};

// 5. Delete Category
export const deleteCategoryController = async (req, res) => {
  try {
    const id = Number(req.params.id);

    await deleteCategory(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
};
