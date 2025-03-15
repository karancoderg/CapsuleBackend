const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Create S3 service object
const s3 = new AWS.S3();

// Configure multer for S3 uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'uploads/' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: function (req, file, cb) {
    // Accept images, videos, documents, and audio files
    const allowedFileTypes = /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|avi|wmv|webm|mkv|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|mp3|wav|ogg|aac)$/i;
    
    // Log the file information for debugging
    console.log("File upload attempt:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    if (!file.originalname.match(allowedFileTypes)) {
      // Log the rejection reason
      console.log(`File rejected: ${file.originalname} (${file.mimetype})`);
      console.log(`File extension not in allowed list: ${allowedFileTypes.source}`);
      
      // Instead of throwing an error, pass it to the callback
      return cb(new Error(`File type not allowed. Allowed types: ${allowedFileTypes.source.replace(/\\|\.\(|\)\$/g, '')}`), false);
    }
    
    // Accept the file
    console.log(`File accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  }
});

// Function to handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    // A non-Multer error occurred
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Function to upload a file buffer directly to S3
const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
  console.log(`Attempting to upload file: ${fileName} (${mimeType}) to S3`);
  console.log(`Using bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `uploads/${Date.now()}-${fileName}`,
    Body: fileBuffer,
    ContentType: mimeType
  };

  try {
    console.log("S3 upload params:", JSON.stringify({
      Bucket: params.Bucket,
      Key: params.Key,
      ContentType: params.ContentType
    }, null, 2));
    
    return new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) {
          console.error('Error uploading to S3:', err);
          return reject(err);
        }
        console.log("S3 upload successful, file URL:", data.Location);
        resolve(data.Location);
      });
    });
  } catch (error) {
    console.error('Error uploading to S3:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Function to delete a file from S3
const deleteFromS3 = async (fileUrl) => {
  // Extract the key from the URL
  const key = fileUrl.split('/').slice(3).join('/');
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key
  };

  try {
    return new Promise((resolve, reject) => {
      s3.deleteObject(params, (err, data) => {
        if (err) {
          console.error('Error deleting from S3:', err);
          return reject(err);
        }
        resolve(true);
      });
    });
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
};

module.exports = { upload, uploadToS3, deleteFromS3, handleMulterError }; 