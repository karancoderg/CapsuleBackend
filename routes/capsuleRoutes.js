const express = require("express");
const { createCapsule, getCapsules, getCapsuleById, addEntryToCapsule } = require("../controllers/capsuleController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

// Optional: Upload route for capsule-level media (if needed)
router.post("/upload", authMiddleware, upload.single("mediaFile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// Capsule creation and listing
router.post("/", authMiddleware, createCapsule);
router.get("/", authMiddleware, getCapsules);

// Get a specific capsule with its entries
router.get("/:capsuleId", authMiddleware, getCapsuleById);

// New route: Add a memory entry to a capsule
router.post("/:capsuleId/entries", authMiddleware, addEntryToCapsule);

module.exports = router;
