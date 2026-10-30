const express = require("express");

const backupController = require("../controllers/backupController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole("ADMIN", "MANAGER"));

router.post("/", backupController.create);
router.post(
    "/validate-package",
    express.raw({ type: ["application/zip", "application/octet-stream"], limit: "50mb" }),
    backupController.validatePackageUpload
);

router.post(
    "/restore-package",
    requireRole("ADMIN"),
    express.raw({
        type: ["application/zip", "application/octet-stream"],
        limit: "50mb",
    }),
    backupController.restorePackageUpload
);
router.post(
    "/reset-operational",
    requireRole("ADMIN"),
    backupController.resetOperational
);
router.post("/package", backupController.createPackage);
router.get("/package/:filename/download", backupController.downloadPackage);
router.get("/:filename/download", backupController.download);

module.exports = router;
