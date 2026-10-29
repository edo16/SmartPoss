const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    const order = await orderService.createOrder({
      ...req.body,
      cashierId: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Order berhasil dibuat",
      data: order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getOrders(req, res) {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const orders = await orderService.getOrders(storeId);

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil orders",
      error: error.message,
    });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("GET ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil order",
      error: error.message,
    });
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
};