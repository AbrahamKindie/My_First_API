
import {
  createProduct,
  updateProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
} from "../services/productService.js";

// 1. Create Product
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

// 2. Get All Products
export const getAllProductsController = async (req, res) => {
  try {
    const { search, categoryId } = req.query;
    const products = await getAllProducts(search, categoryId === undefined ? undefined : Number(categoryId),);

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// 3. Get Product By ID
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

// 4. Update Product
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

// 5. Delete Product
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
