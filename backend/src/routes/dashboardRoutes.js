const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get(
  "/",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  dashboardController.getDashboard
);

module.exports = router;