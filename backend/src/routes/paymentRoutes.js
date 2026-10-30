const express = require("express");

const router = express.Router();

const paymentController =
  require("../controllers/paymentController");

const authMiddleware =
  require("../middleware/authMiddleware");

const requireRole =
  require("../middleware/roleMiddleware");

router.use(authMiddleware);

// ========================================
// GET PAYMENT
// ========================================

router.get(
  "/:id",
  requireRole(
    "ADMIN",
    "MANAGER",
    "CASHIER"
  ),
  paymentController.getPaymentById
);

// ========================================
// CASH PAYMENT
// ========================================

router.post(
  "/:id/cash",
  requireRole(
    "ADMIN",
    "MANAGER",
    "CASHIER"
  ),
  paymentController.processCashPayment
);

// ========================================
// CANCEL PAYMENT
// ========================================
router.post(
  "/:id/cancel",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  paymentController.cancelPayment
);

// ========================================
// DEVELOPMENT ONLY
// ========================================

router.post(
  "/:id/simulate-paid",
  requireRole(
    "ADMIN",
    "MANAGER",
    "CASHIER"
  ),
  paymentController.simulatePaid
);

module.exports = router;