const cron = require("node-cron");
const Capsule = require("../models/Capsule");
const sendEmail = require("../utils/email");

// Function to check for unlocked capsules and notify all associated users
const checkCapsuleUnlocks = async () => {
  try {
    // Find capsules that have unlocked and haven't been notified yet
    const capsules = await Capsule.find({
      lockDate: { $lte: new Date() },
      notified: false
    })
      .populate("createdBy", "email name")
      .populate("members", "email name");

    for (const capsule of capsules) {
      let notifyList = [];

      // Add creator to notify list if they have an email
      if (capsule.createdBy && capsule.createdBy.email) {
        notifyList.push({ name: capsule.createdBy.name, email: capsule.createdBy.email });
      }
      // Add each member to the notify list, avoiding duplicates
      if (capsule.members && capsule.members.length > 0) {
        capsule.members.forEach((member) => {
          if (member.email && (!capsule.createdBy || member.email !== capsule.createdBy.email)) {
            notifyList.push({ name: member.name, email: member.email });
          }
        });
      }

      // Send email notification to each user in the notify list
      for (const userInfo of notifyList) {
        const subject = "Your Collaborative Capsule Has Unlocked!";
        const text = `Hi ${userInfo.name},\n\nA collaborative capsule titled "${capsule.title}" has unlocked. You can now view and contribute to it.\n\nRegards,\nDigital Time Capsule Team`;
        await sendEmail(userInfo.email, subject, text);
      }
      capsule.notified = true;
      await capsule.save();
      console.log(`Notification sent for capsule "${capsule.title}"`);
    }
  } catch (error) {
    console.error("Error in capsule unlock job:", error);
  }
};

// Schedule the job: Run every minute for testing (adjust for production)
cron.schedule("*/1 * * * *", () => {
  console.log("Running capsule unlock check job...");
  checkCapsuleUnlocks();
});

module.exports = { checkCapsuleUnlocks };
