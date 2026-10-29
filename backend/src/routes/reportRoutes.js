const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const reportController = require("../controllers/reportController");

const router = express.Router();
router.use(authMiddleware);

router.get(
  "/export",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  reportController.exportReport
);

router.get(
  "/",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  reportController.getReport
);

module.exports = router;
