const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
  name: String,
  type: String,
  path: String,
  size: Number,
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Folder" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  shared: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  trash: { type: Boolean, default: false },
  trashedAt: { type: Date },
  isLocked: { type: Boolean, default: false },

  // Chunked upload metadata
  uploadMetadata: {
    uploadId: { type: String }, // Reference to upload session
    isChunkedUpload: { type: Boolean, default: false },
    totalChunks: { type: Number },
    chunkSize: { type: Number },
    checksums: {
      md5: String,
      sha256: String,
    },
    uploadStats: {
      totalRetries: { type: Number, default: 0 },
      uploadDuration: Number, // milliseconds
      averageSpeed: Number, // bytes per second
    },
  },
});

// Index for efficient queries
FileSchema.index({ owner: 1, parent: 1, trash: 1 });
FileSchema.index({ "uploadMetadata.uploadId": 1 });

// Text index for full-text search
FileSchema.index({ name: "text" });

// Compound indexes for search with filters
FileSchema.index({ owner: 1, trash: 1, createdAt: -1 });
FileSchema.index({ owner: 1, trash: 1, type: 1 });
FileSchema.index({ owner: 1, trash: 1, size: 1 });

// Pre-save middleware to update timestamp
FileSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("File", FileSchema);
