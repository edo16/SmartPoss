
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const logoController = require("../controllers/logoController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", logoController.getAppLogo);
router.get("/identity", logoController.getAppIdentity);
router.put("/identity", requireRole("ADMIN", "MANAGER"), logoController.updateAppIdentity);
router.post(
    "/logo",
    requireRole("ADMIN", "MANAGER"),
    logoController.uploadMiddleware,
    logoController.uploadAppLogo
);
router.delete(
    "/logo",
    requireRole("ADMIN", "MANAGER"),
    logoController.resetAppLogo
);
module.exports = router;
