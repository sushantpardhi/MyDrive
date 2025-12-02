const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

/**
 * Create a temporary directory for chunked upload
 */
const createTempUploadDir = (userId, uploadId) => {
  const tempDir = path.join(
    __dirname,
    "..",
    "uploads",
    "temp",
    userId,
    uploadId
  );

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return tempDir;
};

/**
 * Get the path for a chunk file
 */
const getChunkPath = (tempDir, chunkIndex) => {
  return path.join(tempDir, `chunk_${chunkIndex.toString().padStart(6, "0")}`);
};

/**
 * Store a chunk to temporary storage
 */
const storeChunk = async (tempDir, chunkIndex, chunkBuffer) => {
  const chunkPath = getChunkPath(tempDir, chunkIndex);

  return new Promise((resolve, reject) => {
    fs.writeFile(chunkPath, chunkBuffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(chunkPath);
      }
    });
  });
};

/**
 * Verify chunk integrity using hash
 */
const verifyChunkIntegrity = async (chunkPath, expectedHash) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(chunkPath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      const calculatedHash = hash.digest("hex");
      resolve(calculatedHash === expectedHash);
    });

    stream.on("error", reject);
  });
};

/**
 * Combine chunks into final file with better memory management
 */
const combineChunks = async (tempDir, totalChunks, outputPath) => {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath, {
      highWaterMark: 64 * 1024, // 64KB buffer
    });
    let currentChunk = 0;
    let totalBytesWritten = 0;

    const writeNextChunk = () => {
      if (currentChunk >= totalChunks) {
        writeStream.end();
        resolve(outputPath);
        return;
      }

      const chunkPath = getChunkPath(tempDir, currentChunk);

      if (!fs.existsSync(chunkPath)) {
        const error = new Error(
          `Chunk ${currentChunk} not found at ${chunkPath}`
        );
        reject(error);
        return;
      }

      // Get chunk size for progress tracking
      const chunkStats = fs.statSync(chunkPath);

      const readStream = fs.createReadStream(chunkPath, {
        highWaterMark: 64 * 1024, // 64KB buffer
      });

      let chunkBytesRead = 0;

      readStream.on("data", (data) => {
        chunkBytesRead += data.length;
        totalBytesWritten += data.length;

        if (!writeStream.write(data)) {
          // Handle backpressure
          readStream.pause();
          writeStream.once("drain", () => {
            readStream.resume();
          });
        }
      });

      readStream.on("end", () => {
        // Clean up chunk file after processing to save disk space
        try {
          fs.unlinkSync(chunkPath);
        } catch (cleanupError) {
          // Don't fail the operation for cleanup errors
        }

        currentChunk++;

        // Add small delay to prevent overwhelming the file system
        if (currentChunk % 100 === 0) {
          setTimeout(writeNextChunk, 10); // 10ms delay every 100 chunks
        } else {
          process.nextTick(writeNextChunk);
        }
      });

      readStream.on("error", (error) => {
        reject(
          new Error(`Failed to read chunk ${currentChunk}: ${error.message}`)
        );
      });
    };

    writeStream.on("error", (error) => {
      reject(new Error(`Failed to write combined file: ${error.message}`));
    });

    writeStream.on("open", () => {
      writeNextChunk();
    });
  });
};

/**
 * Calculate file hash for integrity verification
 */
const calculateFileHash = async (filePath, algorithm = "sha256") => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", reject);
  });
};

/**
 * Clean up temporary upload directory
 */
const cleanupTempDir = (tempDir) => {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    console.error(`Failed to cleanup temp directory ${tempDir}:`, error);
    return false;
  }
};

/**
 * Get final file path for user
 */
const getFinalFilePath = (userId, fileName) => {
  const userDir = path.join(__dirname, "..", "uploads", userId);

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const uniqueFileName = `${uuidv4()}-${fileName}`;
  return path.join(userDir, uniqueFileName);
};

/**
 * Validate chunk sequence and detect missing chunks
 */
const validateChunkSequence = (chunks, totalChunks) => {
  const sortedChunks = chunks.sort((a, b) => a.index - b.index);
  const missingChunks = [];
  const duplicateChunks = [];
  const seenIndices = new Set();

  for (let i = 0; i < totalChunks; i++) {
    const chunk = sortedChunks.find((c) => c.index === i);

    if (!chunk) {
      missingChunks.push(i);
    } else if (seenIndices.has(i)) {
      duplicateChunks.push(i);
    } else {
      seenIndices.add(i);
    }
  }

  return {
    isValid: missingChunks.length === 0 && duplicateChunks.length === 0,
    missingChunks,
    duplicateChunks,
    totalFound: seenIndices.size,
  };
};

/**
 * Calculate upload statistics
 */
const calculateUploadStats = (uploadSession) => {
  const startTime = uploadSession.createdAt;
  const endTime = uploadSession.completedAt || new Date();
  const duration = endTime - startTime; // milliseconds

  const totalBytes = uploadSession.fileSize;
  const uploadedBytes = uploadSession.getTotalUploadedBytes();
  const averageSpeed = duration > 0 ? uploadedBytes / (duration / 1000) : 0; // bytes per second

  return {
    duration,
    averageSpeed,
    totalBytes,
    uploadedBytes,
    completionPercentage: (uploadedBytes / totalBytes) * 100,
  };
};

/**
 * Generate upload session ID
 */
const generateUploadId = () => {
  return `upload_${Date.now()}_${uuidv4().replace(/-/g, "")}`;
};

/**
 * Check if file exists and get its stats
 */
const getFileStats = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    }
    return { exists: false };
  } catch (error) {
    return { exists: false, error: error.message };
  }
};

module.exports = {
  createTempUploadDir,
  getChunkPath,
  storeChunk,
  verifyChunkIntegrity,
  combineChunks,
  calculateFileHash,
  cleanupTempDir,
  getFinalFilePath,
  validateChunkSequence,
  calculateUploadStats,
  generateUploadId,
  getFileStats,
};
