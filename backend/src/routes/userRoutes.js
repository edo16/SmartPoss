const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const userController = require("../controllers/userController");

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole("ADMIN"));

router.get("/", userController.listUsers);
router.post("/", userController.createUser);
router.patch("/:id", userController.updateUser);

module.exports = router;
