const customerService = require("../services/customerService");

async function getCustomers(req, res) {
  try {
    const { storeId, search } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const customers =
      await customerService.getCustomers(
        storeId,
        search || ""
      );

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil member",
      error: error.message,
    });
  }
}

async function getCustomerById(req, res) {
  try {
    const { storeId } = req.query;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi",
      });
    }

    const customer =
      await customerService.getCustomerById(
        storeId,
        id
      );

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("GET CUSTOMER ERROR:", error);

    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

async function createCustomer(req, res) {
  try {
    const customer =
      await customerService.createCustomer(req.body);

    res.status(201).json({
      success: true,
      message: "Member berhasil dibuat",
      data: customer,
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}


async function updateCustomer(req, res) {
  try {
    const customer = await customerService.updateCustomer({
      ...req.body,
      id: req.params.id,
    });

    res.json({
      success: true,
      message: "Data member berhasil diperbarui",
      data: customer,
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);

    const status = error.message === "Member tidak ditemukan"
      ? 404
      : 400;

    res.status(status).json({
      success: false,
      message: error.message || "Gagal memperbarui member",
    });
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
};