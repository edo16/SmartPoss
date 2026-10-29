const express = require("express");

const transactionController =
  require("../controllers/transactionController");

const authMiddleware =
  require("../middleware/authMiddleware");

const refundController =
  require("../controllers/refundController");

const requireRole =
  require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  transactionController.getTransactions
);

router.get(
  "/:id",
  authMiddleware,
  transactionController.getTransactionById
);


// ========================================
// REFUND TRANSAKSI (ADMIN / MANAGER)
// ========================================

router.get(
  "/:id/refunds",
  authMiddleware,
  requireRole("ADMIN", "MANAGER"),
  refundController.getRefunds
);

router.post(
  "/:id/refunds",
  authMiddleware,
  requireRole("ADMIN", "MANAGER"),
  refundController.createRefund
);

router.post(
  "/:id/refunds/:refundId/confirm",
  authMiddleware,
  requireRole("ADMIN", "MANAGER"),
  refundController.confirmRefund
);

router.post(
  "/:id/refunds/:refundId/cancel",
  authMiddleware,
  requireRole("ADMIN", "MANAGER"),
  refundController.cancelRefund
);

module.exports = router;