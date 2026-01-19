/**
 * Download Session Model
 * Tracks chunked download progress with pause/resume/cancel support
 */

const mongoose = require("mongoose");

const ChunkSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  startByte: {
    type: Number,
    required: true,
  },
  endByte: {
    type: Number,
    required: true,
  },
  downloadedAt: {
    type: Date,
    default: null,
  },
});

const DownloadSessionSchema = new mongoose.Schema({
  downloadId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "File",
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  totalChunks: {
    type: Number,
    required: true,
  },
  chunkSize: {
    type: Number,
    required: true,
    default: 1024 * 1024, // 1MB default
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "paused", "cancelled", "completed", "failed"],
    default: "active",
    index: true,
  },
  downloadedChunks: [ChunkSchema],
  lastChunkIndex: {
    type: Number,
    default: -1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  pausedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    default: function () {
      // Sessions expire after 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    },
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    downloadedBytes: {
      type: Number,
      default: 0,
    },
    averageSpeed: Number, // bytes per second
    resumeCount: {
      type: Number,
      default: 0,
    },
  },
});

// Index for cleanup of expired sessions
DownloadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookups
DownloadSessionSchema.index({ owner: 1, status: 1 });
DownloadSessionSchema.index({ fileId: 1, owner: 1 });

// Virtual for download progress
DownloadSessionSchema.virtual("progress").get(function () {
  if (this.totalChunks === 0) return 0;
  return (this.downloadedChunks.length / this.totalChunks) * 100;
});

// Virtual for downloaded bytes
DownloadSessionSchema.virtual("downloadedBytes").get(function () {
  return this.downloadedChunks.reduce((total, chunk) => total + chunk.size, 0);
});

// Method to mark a chunk as downloaded
DownloadSessionSchema.methods.markChunkDownloaded = async function (chunkData) {
  const { index, size, startByte, endByte } = chunkData;

  // Check if chunk already downloaded
  const existingChunk = this.downloadedChunks.find((c) => c.index === index);
  if (existingChunk) {
    return { success: true, existed: true };
  }

  // Add chunk to downloaded list
  this.downloadedChunks.push({
    index,
    size,
    startByte,
    endByte,
    downloadedAt: new Date(),
  });

  // Update last chunk index
  if (index > this.lastChunkIndex) {
    this.lastChunkIndex = index;
  }

  // Update metadata
  this.metadata.downloadedBytes = this.downloadedChunks.reduce(
    (sum, c) => sum + c.size,
    0
  );

  await this.save();
  return { success: true, existed: false };
};

// Method to check if download is complete
DownloadSessionSchema.methods.isComplete = function () {
  return this.downloadedChunks.length === this.totalChunks;
};

// Method to get missing chunks
DownloadSessionSchema.methods.getMissingChunks = function () {
  const downloadedIndices = new Set(
    this.downloadedChunks.map((chunk) => chunk.index)
  );
  const missingChunks = [];

  for (let i = 0; i < this.totalChunks; i++) {
    if (!downloadedIndices.has(i)) {
      missingChunks.push(i);
    }
  }

  return missingChunks;
};

// Method to get next chunk info
DownloadSessionSchema.methods.getNextChunkInfo = function () {
  const missingChunks = this.getMissingChunks();
  if (missingChunks.length === 0) return null;

  const nextIndex = missingChunks[0];
  const startByte = nextIndex * this.chunkSize;
  const endByte = Math.min(startByte + this.chunkSize - 1, this.fileSize - 1);

  return {
    index: nextIndex,
    startByte,
    endByte,
    size: endByte - startByte + 1,
  };
};

// Static method to cleanup expired sessions
DownloadSessionSchema.statics.cleanupExpiredSessions = async function () {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() },
      status: { $in: ["active", "paused", "failed"] },
    });

    return result;
  } catch (error) {
    throw new Error(`Error cleaning up expired download sessions: ${error.message}`);
  }
};

// Static method to generate download ID
DownloadSessionSchema.statics.generateDownloadId = function () {
  const { v4: uuidv4 } = require("uuid");
  return `download_${Date.now()}_${uuidv4().replace(/-/g, "")}`;
};

module.exports = mongoose.model("DownloadSession", DownloadSessionSchema);
