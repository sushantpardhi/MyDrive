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
  hash: {
    type: String,
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
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const UploadSessionSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileType: {
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
    default: 1024 * 1024, // 1MB
  },
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Folder",
    default: null,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: [
      "initiated",
      "uploading",
      "paused",
      "completed",
      "failed",
      "cancelled",
    ],
    default: "initiated",
  },
  uploadedChunks: [ChunkSchema],
  tempDirectory: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    default: function () {
      // Sessions expire after 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    },
  },
  finalFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "File",
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    totalRetries: {
      type: Number,
      default: 0,
    },
    averageSpeed: Number, // bytes per second
  },
});

// Index for cleanup of expired sessions
UploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookups
UploadSessionSchema.index({ uploadId: 1 });
UploadSessionSchema.index({ owner: 1, status: 1 });

// Index for efficient chunk existence checks during parallel uploads
UploadSessionSchema.index({ _id: 1, "uploadedChunks.index": 1 });

// Virtual for upload progress
UploadSessionSchema.virtual("progress").get(function () {
  if (this.totalChunks === 0) return 0;
  return (this.uploadedChunks.length / this.totalChunks) * 100;
});

// Virtual for uploaded bytes
UploadSessionSchema.virtual("uploadedBytes").get(function () {
  return this.uploadedChunks.reduce((total, chunk) => total + chunk.size, 0);
});

// Optimized method to add a chunk - minimal DB queries for performance
UploadSessionSchema.methods.addChunk = async function (chunkData) {
  const maxRetries = 10;
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      // Single atomic operation - no pre-checks, no sorting (happens at read time)
      // MongoDB efficiently handles duplicates via the query condition
      const result = await this.constructor.findOneAndUpdate(
        {
          _id: this._id,
          "uploadedChunks.index": { $ne: chunkData.index }, // Only add if not exists
        },
        {
          $push: { uploadedChunks: chunkData }, // No $sort - major performance boost
        },
        {
          new: false, // Don't return document - huge performance gain
          projection: { _id: 1 }, // Minimal data transfer
          maxTimeMS: 3000,
        }
      );

      if (result) {
        // Successfully added
        return { success: true, existed: false };
      }

      // No result = chunk already exists (OK, not an error)
      return { success: true, existed: true };
    } catch (error) {
      lastError = error;

      // Handle retryable MongoDB errors
      if (
        error.name === "VersionError" ||
        error.codeName === "WriteConflict" ||
        error.code === 11000
      ) {
        retryCount++;

        if (retryCount < maxRetries) {
          // Fast exponential backoff with jitter
          const baseDelay = 20 * Math.pow(1.4, retryCount);
          const jitter = Math.random() * 30;
          const delay = Math.min(baseDelay + jitter, 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Non-retryable error
        console.error(
          `Non-retryable error adding chunk ${chunkData.index}:`,
          error.message
        );
        throw error;
      }
    }
  }

  // All retries exhausted
  console.error(
    `Failed to add chunk ${chunkData.index} after ${maxRetries} retries`
  );
  throw (
    lastError ||
    new Error(
      `Failed to add chunk ${chunkData.index} after ${maxRetries} retries`
    )
  );
};

// Atomic method to add multiple chunks at once (for batch operations)
UploadSessionSchema.methods.addChunks = async function (chunksData) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Get current chunk indices to avoid duplicates
      const existingIndices = new Set(this.uploadedChunks.map((c) => c.index));
      const newChunks = chunksData.filter(
        (chunk) => !existingIndices.has(chunk.index)
      );

      if (newChunks.length === 0) {
        return this; // All chunks already exist
      }

      const result = await this.constructor.findByIdAndUpdate(
        this._id,
        {
          $push: {
            uploadedChunks: {
              $each: newChunks,
              $sort: { index: 1 },
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (result) {
        Object.assign(this, result.toObject());
        return this;
      }

      retryCount++;
    } catch (error) {
      if (error.name === "VersionError" || error.codeName === "WriteConflict") {
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, retryCount), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error(`Failed to add chunks after ${retryCount} retries:`, error);
      throw error;
    }
  }

  throw new Error(`Failed to add chunks after ${maxRetries} retries`);
};

// Method to check if upload is complete
UploadSessionSchema.methods.isComplete = function () {
  return this.uploadedChunks.length === this.totalChunks;
};

// Method to get missing chunks
UploadSessionSchema.methods.getMissingChunks = function () {
  const uploadedIndices = new Set(
    this.uploadedChunks.map((chunk) => chunk.index)
  );
  const missingChunks = [];

  for (let i = 0; i < this.totalChunks; i++) {
    if (!uploadedIndices.has(i)) {
      missingChunks.push(i);
    }
  }

  return missingChunks;
};

// Method to calculate total uploaded bytes
UploadSessionSchema.methods.getTotalUploadedBytes = function () {
  return this.uploadedChunks.reduce((total, chunk) => total + chunk.size, 0);
};

// Pre-save middleware to update status based on chunks
UploadSessionSchema.pre("save", function (next) {
  if (this.isComplete() && this.status === "uploading") {
    this.status = "completed";
    this.completedAt = new Date();
  }
  next();
});

// Static method to cleanup expired sessions
UploadSessionSchema.statics.cleanupExpiredSessions = async function () {
  const fs = require("fs");
  const path = require("path");

  try {
    const expiredSessions = await this.find({
      expiresAt: { $lt: new Date() },
      status: { $in: ["initiated", "uploading", "failed"] },
    });

    // Clean up temporary directories
    for (const session of expiredSessions) {
      try {
        if (fs.existsSync(session.tempDirectory)) {
          fs.rmSync(session.tempDirectory, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(
          `Failed to clean up temp directory ${session.tempDirectory}:`,
          error
        );
      }
    }

    // Remove expired sessions from database
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() },
      status: { $in: ["initiated", "uploading", "failed"] },
    });

    return result;
  } catch (error) {
    console.error("Error cleaning up expired sessions:", error);
    throw error;
  }
};

module.exports = mongoose.model("UploadSession", UploadSessionSchema);
