const Capsule = require("../models/Capsule");
const User = require("../models/User");
const mongoose = require("mongoose");
const { uploadToS3, deleteFromS3 } = require("../config/s3Config");

exports.createCapsule = async (req, res) => {
  try {
    const { title, description, lockDate, media, memberEmails, type } = req.body;
    // memberEmails is expected to be an array of objects: [{ name, email }, ...]
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    let formattedMedia = [];
    if (Array.isArray(media)) {
      formattedMedia = media.map(m => {
        if (typeof m === "string") {
          return { url: m, type: "image/jpeg" }; // Default type if not provided
        }
        return { url: m.url, type: m.type };
      });
    }
    
    let memberIds = [];
    let memberDetails = [];
    let notFoundMembers = [];
    
    // Only process for collaborative capsules
    if (type === "collaborative" && memberEmails && Array.isArray(memberEmails)) {
      for (const member of memberEmails) {
        const email = member.email.toLowerCase();
        const user = await User.findOne({ email });
        
        if (user) {
          memberIds.push(user._id);
          memberDetails.push({
            name: user.name,
            email: user.email
          });
        } else {
          notFoundMembers.push({
            name: member.name || "Unknown",
            email: email
          });
        }
      }
      
      // If no valid members were found, return an error
      if (memberIds.length === 0) {
        return res.status(400).json({ 
          message: "No valid members found. Please ensure at least one member has a registered account.",
          notFoundMembers
        });
      }
    }
    
    const capsule = new Capsule({
      title,            // Group name
      description,      // Description of the group
      lockDate: lockDate ? new Date(lockDate) : null,
      type: type || "personal",
      createdBy: req.user.id,
      media: formattedMedia,
      members: memberIds,
      memberDetails: memberDetails
    });
    
    await capsule.save();
    
    // Return information about which members were found and which weren't
    res.status(201).json({ 
      message: "Collaborative capsule created", 
      capsule,
      memberStatus: {
        found: memberDetails,
        notFound: notFoundMembers
      }
    });
  } catch (error) {
    console.error("Error creating capsule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Upload media to S3
exports.uploadMedia = async (req, res) => {
  try {
    console.log("Upload media request received");
    
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // For direct buffer uploads
    if (!req.file && req.body.fileData) {
      console.log("Processing buffer upload");
      try {
        const { fileData, fileName, fileType } = req.body;
        
        if (!fileData || !fileName || !fileType) {
          console.log("Missing required fields:", { 
            hasFileData: !!fileData, 
            hasFileName: !!fileName, 
            hasFileType: !!fileType 
          });
          return res.status(400).json({ message: "Missing file data, name, or type" });
        }
        
        // Check file type for buffer uploads
        const allowedMimeTypes = [
          'image/jpeg', 'image/png', 'image/gif', 
          'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
          'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain', 'audio/mpeg', 'audio/wav'
        ];
        
        if (!allowedMimeTypes.includes(fileType)) {
          console.log(`File type not allowed: ${fileType}`);
          return res.status(400).json({ message: "File type not allowed" });
        }
        
        // Extract base64 data
        let base64Data = fileData;
        if (fileData.includes(',')) {
          base64Data = fileData.split(',')[1];
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`Buffer created, size: ${buffer.length} bytes`);
        
        // Check file size (10MB limit)
        if (buffer.length > 10 * 1024 * 1024) {
          console.log(`File too large: ${buffer.length} bytes`);
          return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
        }
        
        console.log("Calling uploadToS3 function");
        const fileUrl = await uploadToS3(buffer, fileName, fileType);
        console.log(`File uploaded successfully, URL: ${fileUrl}`);
        
        return res.status(200).json({ 
          url: fileUrl,
          type: fileType
        });
      } catch (error) {
        console.error("Error processing buffer upload:", error);
        return res.status(500).json({ message: "Failed to process file upload" });
      }
    }
    
    // For multer uploads
    if (!req.file) {
      console.log("No file found in request");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("Multer file upload successful:", req.file);
    console.log("File location:", req.file.location);
    
    return res.status(200).json({ 
      url: req.file.location,
      type: req.file.mimetype
    });
  } catch (error) {
    console.error("Error uploading media:", error);
    return res.status(500).json({ message: "Failed to upload media" });
  }
};

// Delete media from S3
exports.deleteMedia = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ message: "File URL is required" });
    }

    await deleteFromS3(fileUrl);
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting media:", error);
    res.status(500).json({ message: "Failed to delete media" });
  }
};

exports.getCapsules = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get personal capsules (created by the user)
    const personalCapsules = await Capsule.find({ createdBy: userId, type: "personal" }).lean();

    // Get collaborative capsules where the user is either the creator or a member.
    const collaborativeCapsules = await Capsule.find({
      type: "collaborative",
      $or: [{ createdBy: userId }, { members: userId }]
    })
      .populate("members", "name email") // Populate members for reference
      .lean();

    res.status(200).json({
      personal: personalCapsules,
      collaborative: collaborativeCapsules
    });
  } catch (error) {
    console.error("Error fetching capsules:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// New: Get details for a specific capsule (including entries)
exports.getCapsuleById = async (req, res) => {
  try {
    const { capsuleId } = req.params;
    const capsule = await Capsule.findById(capsuleId)
      .populate("createdBy", "name email")
      .populate("members", "name email")
      .populate("entries.createdBy", "name email")
      .lean();

    if (!capsule) {
      return res.status(404).json({ message: "Capsule not found" });
    }
    // The returned capsule will include the memberDetails field if it was stored.
    res.json(capsule);
  } catch (error) {
    console.error("Error fetching capsule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// New: Allow a member to add a memory entry to a capsule
exports.addEntryToCapsule = async (req, res) => {
  try {
    const { capsuleId } = req.params;
    const { content, media, lockDate } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Find the capsule
    const capsule = await Capsule.findById(capsuleId);
    if (!capsule) {
      return res.status(404).json({ message: "Capsule not found" });
    }
    
    // Check if requester is the creator or a member
    const isCreator = capsule.createdBy.equals(req.user.id);
    const isMember = capsule.members.some(memberId => memberId.equals(req.user.id));
    if (!isCreator && !isMember) {
      return res.status(403).json({ message: "You are not a member of this capsule" });
    }
    
    // Fetch the user's name
    const userObj = await User.findById(req.user.id);
    if (!userObj) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Ensure media is an array of objects
    let formattedMedia = [];
    if (Array.isArray(media)) {
      formattedMedia = media.map(m => {
        // If m is a string, treat it as an image URL with a default type
        if (typeof m === "string") {
          return { url: m, type: "image/jpeg" };
        }
        // Otherwise, assume it's already an object with url and type
        return { url: m.url, type: m.type };
      });
    }
    
    // Create the memory entry with memberName
    const entry = {
      content,
      media: formattedMedia,
      lockDate: lockDate ? new Date(lockDate) : null,
      createdBy: req.user.id,
      memberName: userObj.name, // Save the member's name
      createdAt: new Date()
    };

    capsule.entries.push(entry);
    await capsule.save();

    res.status(201).json({ message: "Entry added to capsule", entry });
  } catch (error) {
    console.error("Error adding entry:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};