const Capsule = require("../models/Capsule");
const User = require("../models/User");

exports.createCapsule = async (req, res) => {
  try {
    const { title, content, media, lockDate, memberEmails } = req.body;
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Convert memberEmails (if provided) to user IDs
    let members = [];
    if (memberEmails && Array.isArray(memberEmails)) {
      for (const email of memberEmails) {
        const user = await User.findOne({ email });
        if (user) {
          members.push(user._id);
        }
      }
    }
    
    const capsule = new Capsule({
      title,
      content,
      media: media ? (Array.isArray(media) ? media : [media]) : [],
      lockDate: lockDate ? new Date(lockDate) : null,
      createdBy: req.user.id,
      members
    });

    await capsule.save();
    res.status(201).json({ message: "Capsule created", capsule });
  } catch (error) {
    console.error("Error creating capsule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getCapsules = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Optionally, filter capsules by membership or creator.
    const capsules = await Capsule.find({ createdBy: req.user.id });
    res.json(capsules);
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
      .populate("members", "name email");
    if (!capsule) {
      return res.status(404).json({ message: "Capsule not found" });
    }
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
    // Create the memory entry
    const entry = {
      content,
      media: media ? (Array.isArray(media) ? media : [media]) : [],
      lockDate: lockDate ? new Date(lockDate) : null,
      createdBy: req.user.id
    };
    capsule.entries.push(entry);
    await capsule.save();
    res.status(201).json({ message: "Entry added to capsule", capsule });
  } catch (error) {
    console.error("Error adding entry:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
