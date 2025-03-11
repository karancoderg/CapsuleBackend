const express = require("express");
const { register, login, getMe } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", getMe); // Placeholder route for getting user info

module.exports = router;
