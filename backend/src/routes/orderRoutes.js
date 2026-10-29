const express = require("express");

const router = express.Router();

const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.post(
  "/",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  orderController.createOrder
);

router.get(
  "/",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  orderController.getOrders
);

router.get(
  "/:id",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  orderController.getOrderById
);

module.exports = router;