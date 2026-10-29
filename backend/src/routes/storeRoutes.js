const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const storeController = require("../controllers/storeController");
const logoController = require("../controllers/logoController");

const router = express.Router();

router.use(authMiddleware);

router.get("/:id", storeController.getStore);
router.get("/:id/logo", logoController.getStoreLogo);
router.post(
    "/:id/logo",
    requireRole("ADMIN", "MANAGER"),
    logoController.uploadMiddleware,
    logoController.uploadStoreLogo
);
router.delete(
    "/:id/logo",
    requireRole("ADMIN", "MANAGER"),
    logoController.deleteStoreLogo
);
router.patch(
    "/:id",
    requireRole("ADMIN", "MANAGER"),
    storeController.updateStore
);

module.exports = router;
