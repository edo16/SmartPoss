const prisma = require("../lib/prisma");

async function createProduct(data) {
  return await prisma.product.create({
    data,
  });
}

async function getProducts(storeId) {
  return await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getDeletedProducts(storeId) {
  return await prisma.product.findMany({
    where: { storeId, isActive: false },
    orderBy: { updatedAt: "desc" },
  });
}

async function restoreProduct(id) {
  return await prisma.product.update({
    where: { id },
    data: { isActive: true },
  });
}

async function getProductById(id) {
  return await prisma.product.findUnique({
    where: {
      id,
    },
  });
}

async function updateProduct(id, data) {
  return await prisma.product.update({
    where: {
      id,
    },
    data,
  });
}

async function deleteProduct(id) {
  return await prisma.product.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}


async function permanentlyDeleteProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orderItems: true,
          purchaseItems: true,
          stockMovements: true,
        },
      },
    },
  });

  if (!product) {
    const error = new Error("Produk tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  if (product.isActive) {
    const error = new Error("Hanya produk di Tempat Sampah yang dapat dihapus permanen.");
    error.statusCode = 400;
    throw error;
  }

  if (
    product._count.orderItems > 0 ||
    product._count.purchaseItems > 0 ||
    product._count.stockMovements > 0
  ) {
    const error = new Error(
      "Produk tidak dapat dihapus permanen karena masih memiliki riwayat transaksi, pembelian, atau pergerakan stok. Riwayat tersebut dipertahankan."
    );
    error.statusCode = 409;
    throw error;
  }

  return await prisma.product.delete({ where: { id } });
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