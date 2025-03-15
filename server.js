const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files from the uploads folder
app.use("/uploads", express.static("uploads"));

// Routes
const capsuleRoutes = require("./routes/capsuleRoutes");
const authRoutes = require("./routes/authRoutes");

app.use("/api/capsules", capsuleRoutes);
app.use("/api/auth", authRoutes);

// Import the capsule unlock job (scheduled tasks)
require("./jobs/capsuleUnlockJob");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Database Connection Error:", err));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
