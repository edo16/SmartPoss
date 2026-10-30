const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  productController.createProduct
);

router.get(
  "/",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  productController.getProducts
);

router.get(
  "/trash",
  requireRole("ADMIN", "MANAGER"),
  productController.getDeletedProducts
);

router.patch(
  "/:id/restore",
  requireRole("ADMIN", "MANAGER"),
  productController.restoreProduct
);

router.get(
  "/:id",
  requireRole("ADMIN", "MANAGER", "CASHIER"),
  productController.getProductById
);

router.put(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  productController.updateProduct
);

router.delete(
  "/:id/permanent",
  requireRole("ADMIN"),
  productController.permanentlyDeleteProduct
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  productController.deleteProduct
);

module.exports = router;