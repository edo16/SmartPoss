const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/paymentSettingsController");

// Gambar QRIS boleh dibaca POS, termasuk saat menggunakan sesi kasir.
router.get("/qris", controller.getQrisImage);

// Mengubah konfigurasi hanya boleh dilakukan ADMIN atau MANAGER.
router.post(
    "/qris",
    authMiddleware,
    requireRole("ADMIN", "MANAGER"),
    controller.uploadMiddleware,
    controller.uploadQrisImage
);

router.delete(
    "/qris",
    authMiddleware,
    requireRole("ADMIN", "MANAGER"),
    controller.deleteQrisImage
);

module.exports = router;
