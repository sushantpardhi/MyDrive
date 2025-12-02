const mongoose = require("mongoose");

const FolderSchema = new mongoose.Schema({
  name: String,
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Folder",
    default: null,
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  shared: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  trash: { type: Boolean, default: false },
  trashedAt: { type: Date },
});

// Text index for full-text search
FolderSchema.index({ name: "text" });

// Compound indexes for search with filters
FolderSchema.index({ owner: 1, trash: 1, createdAt: -1 });

module.exports = mongoose.model("Folder", FolderSchema);
