// routes/authRoutes.js
const express = require("express");
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  verifyRegistration,
  requestLoginOTP,
  loginWithOTP
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Registration and verification
router.post("/register", register);
router.post("/verify-registration", verifyRegistration);

// OTP-based login
router.post("/request-login-otp", requestLoginOTP);
router.post("/login-with-otp", loginWithOTP);

// Legacy password login
router.post("/login", login);

// Forgot Password & Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected route (with auth middleware)
router.get("/me", authMiddleware, getMe);

module.exports = router;
