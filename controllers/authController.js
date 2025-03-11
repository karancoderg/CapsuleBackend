const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    let { name, email, password } = req.body;
    
    // Convert email to lowercase
    email = email.toLowerCase();

    // Validate password:
    // Must be at least 8 characters, have one uppercase, one lowercase, and one number.
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number."
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already registered, please login"
      });
    }
    
    // Create new user (password hashing happens in the pre-save middleware)
    const user = await User.create({ name, email, password });
    return res.status(201).json({
      message: "User registered successfully, please login"
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "User not registered"
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, user });
    console.log("User logged in:", user);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getMe = async (req, res) => {
  // For now, simply send a placeholder response.
  res.json({ message: "User info route (to be implemented with auth middleware)" });
};
