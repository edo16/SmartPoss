const paymentService = require("../services/paymentService");

// ========================================
// GET PAYMENT
// ========================================

async function getPaymentById(req, res) {
  try {
    const { id } = req.params;

    const payment =
      await paymentService.getPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Gagal mengambil payment",
      error: error.message,
    });
  }
}

// ========================================
// SIMULATE PAID
// ========================================

async function simulatePaid(req, res) {
  try {
    const { id } = req.params;

    const result =
      await paymentService.markPaymentPaid(
        id
      );

    res.json({
      success: true,
      message:
        "Pembayaran berhasil disimulasikan",
      data: result,
    });
  } catch (error) {
    console.error(
      "SIMULATE PAYMENT ERROR:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// ========================================
// CASH PAYMENT
// ========================================

async function processCashPayment(
  req,
  res
) {
  try {
    const { id } = req.params;

    const { cashReceived } =
      req.body;

    if (
      cashReceived === undefined ||
      cashReceived === null ||
      cashReceived === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "cashReceived wajib diisi",
      });
    }

    const result =
      await paymentService.processCashPayment(
        id,
        cashReceived
      );

    res.json({
      success: true,
      message:
        "Pembayaran cash berhasil",
      data: result,
    });
  } catch (error) {
    console.error(
      "CASH PAYMENT ERROR:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}


async function cancelPayment(req, res) {
  try {
      const result = await paymentService.cancelPendingPayment(
          req.params.id
      );

      return res.json({
          success: true,
          message: "Pembayaran berhasil dibatalkan",
          data: result,
      });
  } catch (error) {
      console.error("CANCEL PAYMENT ERROR:", error);

      return res.status(400).json({
          success: false,
          message: error.message,
      });
  }
}

module.exports = {
  getPaymentById,
  simulatePaid,
  processCashPayment,
  cancelPayment,
};