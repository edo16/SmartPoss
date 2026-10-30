const refundService = require("../services/refundService");

function sendError(res, error) {
  const status = error.status || 500;

  if (status >= 500) {
    console.error("REFUND ERROR:", error);
  }

  return res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "Terjadi kesalahan saat memproses refund."
        : error.message,
  });
}

function requireStoreId(req, res) {
  const storeId = req.query.storeId;

  if (!storeId || typeof storeId !== "string") {
    res.status(400).json({
      success: false,
      message: "storeId wajib diisi melalui query parameter.",
    });
    return null;
  }

  return storeId;
}

async function createRefund(req, res) {
  try {
    const storeId = requireStoreId(req, res);
    if (!storeId) return;

    const { amount, reason } = req.body || {};

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(Number(amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "Nominal refund wajib berupa angka yang valid.",
      });
    }

    const refund = await refundService.createRefund({
      storeId,
      orderId: req.params.id,
      amount: Number(amount),
      reason,
      requestedById: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Pengajuan refund berhasil dibuat dan menunggu konfirmasi.",
      data: refund,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function confirmRefund(req, res) {
  try {
    const storeId = requireStoreId(req, res);
    if (!storeId) return;

    const result = await refundService.confirmRefund({
      storeId,
      orderId: req.params.id,
      refundId: req.params.refundId,
      confirmedById: req.user.userId,
    });

    return res.json({
      success: true,
      message: result.fullyRefunded
        ? "Refund dikonfirmasi. Transaksi telah berstatus REFUNDED."
        : "Refund dikonfirmasi.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function cancelRefund(req, res) {
  try {
    const storeId = requireStoreId(req, res);
    if (!storeId) return;

    const refund = await refundService.cancelRefund({
      storeId,
      orderId: req.params.id,
      refundId: req.params.refundId,
    });

    return res.json({
      success: true,
      message: "Pengajuan refund berhasil dibatalkan.",
      data: refund,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRefunds(req, res) {
  try {
    const storeId = requireStoreId(req, res);
    if (!storeId) return;

    const refunds = await refundService.getRefunds({
      storeId,
      orderId: req.params.id,
    });

    return res.json({
      success: true,
      data: refunds,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createRefund,
  confirmRefund,
  cancelRefund,
  getRefunds,
};
