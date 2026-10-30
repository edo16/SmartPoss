const productService = require("../services/productService");

async function createProduct(req, res) {
  try {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
}

async function getProducts(req, res) {
  try {
    const { storeId } = req.query;

    const products = await productService.getProducts(storeId);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get products",
      error: error.message,
    });
  }
}

async function getDeletedProducts(req, res) {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const products = await productService.getDeletedProducts(storeId);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error("GET DELETED PRODUCTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil produk di tempat sampah",
      error: error.message,
    });
  }
}

async function restoreProduct(req, res) {
  try {
    const product = await productService.restoreProduct(req.params.id);
    res.json({
      success: true,
      message: "Produk berhasil dipulihkan",
      data: product,
    });
  } catch (error) {
    console.error("RESTORE PRODUCT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memulihkan produk",
      error: error.message,
    });
  }
}

async function getProductById(req, res) {
  try {
    const { id } = req.params;

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to get product",
      error: error.message,
    });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await productService.updateProduct(
      id,
      req.body
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
}

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await productService.deleteProduct(id);

    res.json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
}


async function permanentlyDeleteProduct(req, res) {
  try {
    const product = await productService.permanentlyDeleteProduct(req.params.id);
    res.json({
      success: true,
      message: "Produk berhasil dihapus permanen",
      data: product,
    });
  } catch (error) {
    console.error("PERMANENT DELETE PRODUCT ERROR:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Gagal menghapus produk permanen",
    });
  }
}

module.exports = {
  createProduct,
  getProducts,
  getDeletedProducts,
  restoreProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  permanentlyDeleteProduct,
};