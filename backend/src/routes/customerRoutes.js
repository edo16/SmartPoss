const express = require("express");

const customerController =
  require("../controllers/customerController");

const authMiddleware =
  require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  customerController.getCustomers
);

router.get(
  "/:id",
  customerController.getCustomerById
);

router.post(
  "/",
  customerController.createCustomer
);

router.patch(
  "/:id",
  customerController.updateCustomer
);

module.exports = router;