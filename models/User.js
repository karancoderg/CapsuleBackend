const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
});

// Pre-save hook: Hash password only if it's not already hashed
UserSchema.pre("save", async function (next) {
  // If the password already appears hashed, skip re-hashing
  if (this.password.startsWith("$2a$") || this.password.startsWith("$2b$") || this.password.startsWith("$2y$")) {
    return next();
  }
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to generate reset token
UserSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  // Hash the token before storing in DB
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  // Set token expiry (e.g., 10 minutes from now)
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Method to check if account is locked
UserSchema.methods.isLocked = function() {
  // Check if the lockUntil is set and if the current time is before that
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
UserSchema.methods.incrementLoginAttempts = async function() {
  // If we have a previous lock that has expired, reset the count
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    // Increment login attempts
    this.loginAttempts += 1;
    
    // Lock the account if we've reached max attempts (5)
    if (this.loginAttempts >= 5) {
      // Lock for 30 minutes
      this.lockUntil = Date.now() + 30 * 60 * 1000;
    }
  }
  
  return await this.save();
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return await this.save();
};

module.exports = mongoose.model("User", UserSchema);
