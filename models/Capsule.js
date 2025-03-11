const mongoose = require("mongoose");

const MemoryEntrySchema = new mongoose.Schema({
  content: { type: String, required: true },
  media: [{ type: String }], // optional media URLs for the entry
  lockDate: { type: Date },  // optional lock date for this entry
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});

const CapsuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String }, // optional capsule description
  media: [{ type: String }], // optional capsule-level media
  lockDate: { type: Date },  // capsule-level lock date (for full capsule)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // collaborators
  entries: [MemoryEntrySchema], // memory entries added by members
  createdAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false }
});

module.exports = mongoose.model("Capsule", CapsuleSchema);
