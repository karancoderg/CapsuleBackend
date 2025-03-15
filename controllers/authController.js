const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const User = require("../models/User");
const sendEmail = require("../utils/email");
require("dotenv").config();

// Generate OTP
const generateOTP = () => {
  return speakeasy.totp({
    secret: process.env.OTP_SECRET || "defaultsecret",
    digits: 6,
    step: 600 // 10 minutes
  });
};

// Verify OTP
const verifyOTP = (token, otp) => {
  return speakeasy.totp.verify({
    secret: process.env.OTP_SECRET || "defaultsecret",
    token: token,
    digits: 6,
    step: 600, // 10 minutes
    window: 1 // Allow 1 step before and after for time drift
  });
};

// Register User
exports.register = async (req, res) => {
  try {
    let { name, email, password, confirmPassword } = req.body;
    email = email.toLowerCase();

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match."
      });
    }

    // Basic password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already registered, please login." });
    }

    // Create user (not verified yet)
    const user = new User({ 
      name, 
      email, 
      password,
      isVerified: false
    });

    // Generate OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = Date.now() + (parseInt(process.env.OTP_EXPIRY) || 600) * 1000; // 10 minutes

    await user.save();

    // Send OTP via email
    const message = `Your verification code is: ${otp}. This code will expire in 10 minutes.`;
    await sendEmail(email, "Account Verification Code", message);

    return res.status(201).json({ 
      message: "Registration initiated. Please verify your email with the OTP sent to your email address.",
      email
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "User not registered" });
  }
};

// Verify OTP after registration
exports.verifyRegistration = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      otpExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.json({ 
      message: "Account verified successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ message: "Verification failed" });
  }
};

// Request Login OTP
exports.requestLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(400).json({ 
        message: "Account is locked due to too many failed attempts. Please try again later." 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: "Account not verified. Please complete registration first." });
    }

    // Generate OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = Date.now() + (parseInt(process.env.OTP_EXPIRY) || 600) * 1000; // 10 minutes

    await user.save();

    // Send OTP via email
    const message = `Your login verification code is: ${otp}. This code will expire in 10 minutes.`;
    await sendEmail(email, "Login Verification Code", message);

    return res.status(200).json({ 
      message: "Login OTP sent to your email.",
      email
    });
  } catch (error) {
    console.error("Login OTP request error:", error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

// Login with OTP
exports.loginWithOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      otpExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(400).json({ 
        message: "Account is locked due to too many failed attempts. Please try again later." 
      });
    }

    // Verify OTP
    if (user.otp !== otp) {
      // Increment login attempts
      await user.incrementLoginAttempts();
      
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Clear OTP
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.json({ 
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

// Legacy Login (with password)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(400).json({ 
        message: "Account is locked due to too many failed attempts. Please try again later." 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: "Account not verified. Please complete registration first." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment login attempts
      await user.incrementLoginAttempts();
      
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.json({ 
      message: "Login successful.",
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot password requested for:", email);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token (unhashed)
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Hash the token for storage
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Valid for 10 minutes

    console.log("Generated Reset Token (plain):", resetToken);
    console.log("Stored Hashed Token:", user.resetPasswordToken);
    console.log("Token Expires At:", new Date(user.resetPasswordExpires));

    // Save user with token info
    await user.save({ validateBeforeSave: false });

    // Build the reset URL (make sure FRONTEND_URL is set in .env)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    console.log("Reset URL:", resetUrl);

    // Compose email message
    const message = `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link is valid for 10 minutes. If you didn't request this, please ignore this email.`;

    // Send email using your sendEmail utility
    await sendEmail(user.email, "Password Reset Request", message);
    console.log("Email sent successfully to:", user.email);

    return res.status(200).json({ message: "Reset link sent to your email." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: "Email could not be sent." });
  }
};

// Reset Password Controller
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params; // Unhashed token from URL
    const { password, confirmPassword } = req.body; // New password

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match."
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    // Hash the token to compare with what's stored in DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    console.log("Computed Hashed Token:", hashedToken);

    // Find user with the matching token and check token expiry
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log("Invalid or expired token.");
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Hash new password (only once)
    const newHashedPassword = await bcrypt.hash(password, 10);
    user.password = newHashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    console.log("Password reset successful for user:", user.email);
    return res.status(200).json({ message: "Password reset successful! You can now log in." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Could not reset password." });
  }
};

// Protected Route Example
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -otpExpiry");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};