const express = require("express");

const router = express.Router();

const analyticsController =
    require("../controllers/analyticsController");

const authMiddleware =
    require("../middleware/authMiddleware");

const requireRole =
    require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get(
    "/",
    requireRole(
        "ADMIN",
        "MANAGER",
        "CASHIER"
    ),
    analyticsController.getAnalytics
);

module.exports = router;