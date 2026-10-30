const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.get("/settings", authController.getSettings);
router.post("/login", authController.login);
router.post("/guest", authController.guestLogin);

// Hanya ADMIN yang boleh menonaktifkan kewajiban login.
router.patch(
  "/settings",
  authMiddleware,
  requireRole("ADMIN"),
  authController.updateSettings
);

// Endpoint pemulihan: login wajib dapat diaktifkan kembali dari sesi tamu.
router.post("/enable-login", authController.enableLogin);

module.exports = router;
