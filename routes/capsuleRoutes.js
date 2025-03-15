const express = require("express");
const { 
  createCapsule, 
  getCapsules, 
  getCapsuleById, 
  addEntryToCapsule,
  uploadMedia,
  deleteMedia
} = require("../controllers/capsuleController");
const authMiddleware = require("../middleware/authMiddleware");
const { upload, handleMulterError } = require("../config/s3Config");
const AWS = require('aws-sdk');

const router = express.Router();

// Test route to verify S3 connectivity
router.get("/test-s3", async (req, res) => {
  try {
    console.log("Testing S3 connectivity");
    console.log("AWS Config:", {
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET_NAME,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });
    
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    
    // List buckets to test connectivity
    s3.listBuckets((err, data) => {
      if (err) {
        console.error("S3 test error:", err);
        return res.status(500).json({ 
          message: "S3 connection failed", 
          error: err.message 
        });
      }
      
      console.log("S3 buckets:", data.Buckets.map(b => b.Name));
      
      // Check if our bucket exists
      const bucketExists = data.Buckets.some(b => b.Name === process.env.AWS_S3_BUCKET_NAME);
      
      if (!bucketExists) {
        console.log(`Bucket ${process.env.AWS_S3_BUCKET_NAME} not found`);
        return res.status(404).json({ 
          message: `Bucket ${process.env.AWS_S3_BUCKET_NAME} not found`,
          buckets: data.Buckets.map(b => b.Name)
        });
      }
      
      return res.status(200).json({ 
        message: "S3 connection successful", 
        bucket: process.env.AWS_S3_BUCKET_NAME,
        buckets: data.Buckets.map(b => b.Name)
      });
    });
  } catch (error) {
    console.error("S3 test error:", error);
    return res.status(500).json({ 
      message: "S3 connection failed", 
      error: error.message 
    });
  }
});

// S3 file upload endpoint with error handling
router.post("/upload", authMiddleware, (req, res, next) => {
  console.log("File upload request received");
  
  upload.single("mediaFile")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      
      // Provide more specific error messages based on error type
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: "File too large. Maximum size is 10MB.",
          error: err.message
        });
      } else if (err.message && err.message.includes('File type not allowed')) {
        return res.status(400).json({ 
          message: err.message,
          error: "file_type_not_allowed"
        });
      }
      
      return res.status(400).json({ 
        message: err.message || "Error uploading file",
        error: "upload_error"
      });
    }
    
    if (!req.file) {
      console.error("No file received in the request");
      return res.status(400).json({ 
        message: "No file uploaded", 
        error: "no_file"
      });
    }
    
    console.log("File successfully processed by multer:", {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      location: req.file.location
    });
    
    next();
  });
}, uploadMedia);

// Direct buffer upload to S3 (for base64 encoded files)
router.post("/upload-buffer", authMiddleware, uploadMedia);

// Delete file from S3
router.delete("/media", authMiddleware, deleteMedia);

// Capsule creation endpoint (handles both personal and collaborative)
router.post("/", authMiddleware, createCapsule);
router.get("/", authMiddleware, getCapsules);
router.get("/:capsuleId", authMiddleware, getCapsuleById);
router.post("/:capsuleId/entries", authMiddleware, addEntryToCapsule);

module.exports = router;
