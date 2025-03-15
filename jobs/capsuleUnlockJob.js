const cron = require("node-cron");
const Capsule = require("../models/Capsule");
const sendEmail = require("../utils/email");
require('dotenv').config();

// Get the frontend URL from environment variables
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Collaborative Memory Unlock Check:
// For collaborative capsules, iterate through each memory entry.
// If an entry's lockDate has passed and it hasn't been notified,
// send notifications to all members and mark the entry as notified.
const checkCollaborativeMemoryUnlocks = async () => {
  try {
    const now = new Date();
    // Find all collaborative capsules that have at least one memory entry
    const capsules = await Capsule.find({
      type: "collaborative",
      "entries.0": { $exists: true }
    })
      .populate("createdBy", "name email")
      .populate("members", "name email")
      .lean();

    for (const capsule of capsules) {
      let updated = false;
      // Process each memory entry
      const updatedEntries = capsule.entries.map(entry => {
        if (entry.lockDate && new Date(entry.lockDate) <= now && !entry.notified) {
          // Build notify list: use capsule.memberDetails if available, else members array
          let notifyList = [];
          if (capsule.memberDetails && capsule.memberDetails.length > 0) {
            notifyList = capsule.memberDetails;
          } else if (capsule.members && capsule.members.length > 0) {
            notifyList = capsule.members.map(m => ({ name: m.name, email: m.email }));
          }
          
          // Create a link to the capsule
          const capsuleLink = `${FRONTEND_URL}/capsules/${capsule._id}`;
          
          // Send notification email to each member
          notifyList.forEach(async (member) => {
            const subject = `Memory Unlocked in Capsule: ${capsule.title}`;
            const text = `Hi ${member.name},\n\nA memory added by ${entry.memberName} in the collaborative capsule "${capsule.title}" has unlocked.\n\nYou can view it here: ${capsuleLink}\n\nNote: You'll need to log in to access the capsule.\n\nRegards,\nDigital Time Capsule Team`;
            await sendEmail(member.email, subject, text);
          });
          // Mark the entry as notified
          entry.notified = true;
          updated = true;
        }
        return entry;
      });

      if (updated) {
        // Update the capsule with the modified entries
        await Capsule.findByIdAndUpdate(capsule._id, { entries: updatedEntries });
        console.log(`Notified members for unlocked memory entries in capsule "${capsule.title}"`);
      }
    }
  } catch (error) {
    console.error("Error in collaborative memory unlock job:", error);
  }
};

// Personal Capsule Unlock Check:
// For personal capsules, when the capsule's lockDate has passed and not notified,
// send a notification email to the capsule creator and mark the capsule as notified.
const checkPersonalCapsuleUnlocks = async () => {
  try {
    const now = new Date();
    const capsules = await Capsule.find({
      type: "personal",
      lockDate: { $lte: now },
      notified: false
    }).populate("createdBy", "name email").lean();

    for (const capsule of capsules) {
      if (capsule.createdBy && capsule.createdBy.email) {
        // Create a link to the capsule
        const capsuleLink = `${FRONTEND_URL}/capsules/${capsule._id}`;
        
        const subject = `Your Personal Capsule Has Unlocked!`;
        const text = `Hi ${capsule.createdBy.name},\n\nYour personal capsule titled "${capsule.title}" has unlocked. You can now view its content.\n\nAccess your capsule here: ${capsuleLink}\n\nNote: You'll need to log in to access the capsule.\n\nRegards,\nDigital Time Capsule Team`;
        await sendEmail(capsule.createdBy.email, subject, text);
        await Capsule.findByIdAndUpdate(capsule._id, { notified: true });
        console.log(`Notified personal capsule creator for capsule "${capsule.title}"`);
      }
    }
  } catch (error) {
    console.error("Error in personal capsule unlock job:", error);
  }
};

// Schedule the job to run every minute (for testing; adjust schedule for production)
cron.schedule("*/1 * * * *", async () => {
  console.log("Running capsule unlock check job...");
  await checkCollaborativeMemoryUnlocks();
  await checkPersonalCapsuleUnlocks();
});

module.exports = { checkCollaborativeMemoryUnlocks, checkPersonalCapsuleUnlocks };
