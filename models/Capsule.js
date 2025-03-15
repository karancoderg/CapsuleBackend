const mongoose = require("mongoose");

const MemoryEntrySchema = new mongoose.Schema({
  content: { type: String, required: true },
  media: [
    {
      url: { type: String, required: true },
      type: { type: String, required: true }
    }
  ],
  lockDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  memberName: { type: String, required: true },
  notified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});



const CapsuleSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Group name
  description: { type: String },
  content: { type: String },
  media: [{
    url: { type: String, required: true },
    type: { type: String, required: true }
  }], // Now stores objects with url and type
  lockDate: { type: Date },
  type: { type: String, enum: ["personal", "collaborative"], default: "personal" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  memberDetails: [{
    name: String,
    email: String
  }],
  entries: [MemoryEntrySchema],
  createdAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false }
});

module.exports = mongoose.model("Capsule", CapsuleSchema);
