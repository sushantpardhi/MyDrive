const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const logger = require("../utils/logger");
const File = require("../models/File");
const User = require("../models/User");
const UploadSession = require("../models/UploadSession");
const DownloadSession = require("../models/DownloadSession");
const { ensureUserDir, getUserFilePath } = require("../utils/fileHelpers");
const emailService = require("../utils/emailService");
const {
  validateStorageForUpload,
  handlePostUploadNotification,
} = require("../utils/storageHelpers");
const {
  createTempUploadDir,
  storeChunk,
  verifyChunkIntegrity,
  combineChunks,
  calculateFileHash,
  cleanupTempDir,
  getFinalFilePath,
  validateChunkSequence,
  calculateUploadStats,
  generateUploadId,
} = require("../utils/chunkHelpers");
const redisQueue = require("../utils/redisQueue");

const router = express.Router();

// Environment configuration
const CHUNK_SIZE = process.env.CHUNK_SIZE
  ? parseInt(process.env.CHUNK_SIZE)
  : 1024 * 1024; // 1MB default
const MAX_CHUNK_SIZE = process.env.MAX_CHUNK_SIZE
  ? parseInt(process.env.MAX_CHUNK_SIZE)
  : 10 * 1024 * 1024; // 10MB default
const SESSION_LOOKUP_TIMEOUT = process.env.SESSION_LOOKUP_TIMEOUT
  ? parseInt(process.env.SESSION_LOOKUP_TIMEOUT)
  : 5000; // 5s default

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific directory
    const userDir = ensureUserDir(req.user.id);
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Upload file
router.post("/upload", upload.single("file"), async (req, res) => {
  const startTime = Date.now();
  try {
    // Get user to check storage limits
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate storage availability before upload
    const storageError = validateStorageForUpload(user, req.file.size);
    if (storageError) {
      // Delete the uploaded file since we're rejecting it
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      logger.warn("Upload rejected - Storage limit exceeded", {
        userId: req.user.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
      return res.status(413).json(storageError);
    }

    const { parent } = req.body;
    const file = new File({
      name: req.file.originalname,
      type: req.file.mimetype || path.extname(req.file.originalname),
      path: req.file.path,
      size: req.file.size,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
    });
    await file.save();

    // Update user's storage usage
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { storageUsed: req.file.size },
    });

    // Send storage notification if threshold crossed
    handlePostUploadNotification(user, req.file.size).catch((error) => {
      logger.error("Failed to send storage notification", {
        userId: req.user.id,
        error: error.message,
      });
    });

    // Send image files to Redis queue for processing
    if (redisQueue.isImageFile(req.file.mimetype)) {
      redisQueue.sendImageJob({
        filePath: req.file.path,
        fileName: req.file.originalname,
        userId: req.user.id,
        mimetype: req.file.mimetype,
      }).catch((error) => {
        logger.error("Failed to send image to processing queue", {
          userId: req.user.id,
          fileName: req.file.originalname,
          error: error.message,
        });
      });
    }

    logger.logFileOperation("upload", file, req.user.id, {
      fileSize: file.size,
      mimeType: req.file.mimetype,
      duration: Date.now() - startTime,
      ip: req.ip,
    });

    res.json(file);
  } catch (error) {
    logger.logError(error, {
      operation: "upload",
      userId: req.user.id,
      ip: req.ip,
    });
    res.status(500).json({ error: error.message });
  }
});

// Verify file download permissions and return metadata
router.get("/verify-download/:fileId", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      logger.warn(
        `Download verification failed - File not found: ${req.params.fileId} - User: ${req.user.id} - IP: ${req.ip}`
      );
      return res.status(404).json({ error: "File not found" });
    }

    // Return file metadata for frontend to initiate download
    res.json({
      id: file._id,
      name: file.name,
      size: file.size,
      type: file.type,
      verified: true
    });
  } catch (error) {
    logger.logError(error, {
      operation: "verify-download",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.params.fileId,
    });
    res.status(500).json({ error: error.message });
  }
});

// Download file with proper client disconnect handling
router.get("/download/:fileId", async (req, res) => {
  const startTime = Date.now();
  let fileStream = null;
  let isAborted = false;
  
  // Handle client disconnect
  const handleDisconnect = () => {
    if (isAborted) return;
    isAborted = true;
    
    logger.warn("Client disconnected during file download", {
      fileId: req.params.fileId,
      userId: req.user.id,
      ip: req.ip,
    });
    
    // Destroy the file stream if it exists
    if (fileStream && !fileStream.destroyed) {
      fileStream.destroy();
    }
  };
  
  req.on("close", handleDisconnect);
  req.on("aborted", handleDisconnect);
  
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      logger.warn(
        `Download failed - File not found: ${req.params.fileId} - User: ${req.user.id} - IP: ${req.ip}`
      );
      return res.status(404).json({ error: "File not found" });
    }

    // Check if conversion to JPEG is requested (for HEIC/HEIF files)
    const convertToJpeg = req.query.convert === "true";
    const ext = path.extname(file.name).toLowerCase();
    const isHeicFormat = [".heic", ".heif"].includes(ext);

    if (convertToJpeg && isHeicFormat) {
      // Convert HEIC/HEIF to JPEG on the server
      try {
        const buffer = await sharp(file.path).jpeg({ quality: 90 }).toBuffer();

        if (isAborted) {
          logger.info("Download cancelled during HEIC conversion", {
            fileId: req.params.fileId,
            userId: req.user.id,
          });
          return;
        }

        res.set({
          "Content-Type": "image/jpeg",
          "Content-Length": buffer.length,
          "Cache-Control": "public, max-age=31536000",
        });

        logger.logFileOperation("download-converted", file, req.user.id, {
          fileSize: buffer.length,
          mimeType: "image/jpeg",
          duration: Date.now() - startTime,
          ip: req.ip,
        });

        res.send(buffer);
      } catch (conversionError) {
        if (isAborted) return;
        
        logger.logError(conversionError, {
          operation: "HEIC-conversion",
          userId: req.user.id,
          additionalInfo: file.name,
        });
        // Fallback to streaming original file
        if (!res.headersSent) {
          await streamFileWithDisconnectHandling(res, file, isAborted, () => isAborted, logger, req.user.id, req.ip, startTime);
        }
      }
    } else {
      // Stream the file with disconnect handling
      await streamFileWithDisconnectHandling(res, file, fileStream, () => isAborted, logger, req.user.id, req.ip, startTime);
    }
  } catch (error) {
    if (isAborted) return;
    
    logger.logError(error, {
      operation: "download",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.params.fileId,
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Helper function to stream file with disconnect handling
async function streamFileWithDisconnectHandling(res, file, streamRef, isAbortedFn, logger, userId, ip, startTime) {
  return new Promise((resolve, reject) => {
    if (isAbortedFn()) {
      resolve();
      return;
    }
    
    const stream = fs.createReadStream(file.path);
    streamRef = stream;
    
    // Set headers
    res.set({
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": file.size,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
    });
    
    stream.on("error", (err) => {
      if (!isAbortedFn()) {
        logger.logError(err, {
          operation: "download-stream",
          userId,
          additionalInfo: file.name,
        });
      }
      stream.destroy();
      reject(err);
    });
    
    stream.on("end", () => {
      if (!isAbortedFn()) {
        logger.logFileOperation("download", file, userId, {
          fileSize: file.size,
          duration: Date.now() - startTime,
          ip,
        });
      }
      resolve();
    });
    
    stream.on("close", resolve);
    
    stream.pipe(res);
  });
}

// Get thumbnail for preview (from worker-processed images)
router.get("/thumbnail/:fileId", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const ext = path.extname(file.name).toLowerCase();
    const isImage = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".tiff",
    ].includes(ext);

    const isHeic = [".heic", ".heif"].includes(ext);

    if (!isImage && !isHeic) {
      return res.status(400).json({ error: "File is not an image" });
    }

    // For HEIC files, send original file (client will handle conversion)
    if (isHeic) {
      res.set({
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.sendFile(path.resolve(file.path));
    }

    // Verify file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Extract the file's base name (UUID-originalname without extension)
    const filePath = file.path;
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Construct path to worker-processed thumbnail image
    const userDir = path.dirname(filePath);
    const processedDir = path.join(userDir, "processed");
    const thumbnailPath = path.join(processedDir, `${fileName}_thumbnail.webp`);

    // Check if worker-generated thumbnail exists
    if (fs.existsSync(thumbnailPath)) {
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.sendFile(path.resolve(thumbnailPath));
    }

    // Fallback: return 404 if thumbnail not yet processed by worker
    res.status(404).json({ 
      error: "Thumbnail not available yet",
      message: "Image is still being processed"
    });
  } catch (error) {
    logger.logError(error, "Error in thumbnail route");
    res.status(500).json({ error: error.message });
  }
});

// Get blur image for progressive loading
router.get("/blur/:fileId", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Extract the file's base name (UUID-originalname without extension)
    const filePath = file.path;
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Construct path to processed blur image
    const userDir = path.dirname(filePath);
    const processedDir = path.join(userDir, "processed");
    const blurPath = path.join(processedDir, `${fileName}_blur.webp`);

    // Check if blur image exists
    if (fs.existsSync(blurPath)) {
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.sendFile(path.resolve(blurPath));
    }

    // Fallback: return 404 if blur image not yet processed
    res.status(404).json({ 
      error: "Blur image not available yet",
      message: "Image is still being processed"
    });
  } catch (error) {
    logger.logError(error, "Error in blur route");
    res.status(500).json({ error: error.message });
  }
});

// Get low-quality image for progressive loading
router.get("/low-quality/:fileId", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Extract the file's base name (UUID-originalname without extension)
    const filePath = file.path;
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Construct path to processed low-quality image
    const userDir = path.dirname(filePath);
    const processedDir = path.join(userDir, "processed");
    const lowQualityPath = path.join(processedDir, `${fileName}_low-quality.webp`);

    // Check if low-quality image exists
    if (fs.existsSync(lowQualityPath)) {
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.sendFile(path.resolve(lowQualityPath));
    }

    // Fallback: return 404 if low-quality image not yet processed
    res.status(404).json({ 
      error: "Low-quality image not available yet",
      message: "Image is still being processed"
    });
  } catch (error) {
    logger.logError(error, "Error in low-quality route");
    res.status(500).json({ error: error.message });
  }
});

// Get file details with populated shared users
router.get("/:fileId/details", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId)
      .populate("shared", "name email")
      .populate("owner", "name email");
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share file - Updated to accept email instead of userId
router.post("/:id/share", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only share items you own" });
    }

    // Find user by email
    const userToShareWith = await User.findOne({ email });
    if (!userToShareWith) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't share with yourself
    if (userToShareWith._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot share with yourself" });
    }

    // Add user to shared array if not already shared
    if (!item.shared.includes(userToShareWith._id)) {
      item.shared.push(userToShareWith._id);
      await item.save();

      // Send email notification to the user (non-blocking)
      const owner = await User.findById(req.user.id);
      emailService
        .sendFileSharedEmail(userToShareWith, owner, item.name, "file")
        .catch(() => {
          // Email notification failed, but sharing was successful
        });
    }

    res.json({
      message: "File shared successfully",
      item: await File.findById(id).populate("shared", "name email"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unshare file - Remove user from shared list
router.delete("/:id/share/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only unshare items you own" });
    }

    // Remove user from shared array
    item.shared = item.shared.filter(
      (sharedUserId) => sharedUserId.toString() !== userId
    );
    await item.save();

    res.json({
      message: "User removed from shared list",
      item: await File.findById(id).populate("shared", "name email"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move file to trash or permanently delete
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === "true";

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete items you own" });
    }

    if (permanent) {
      // Permanently delete
      if (fs.existsSync(item.path)) {
        fs.unlinkSync(item.path);
      }

      // Delete cached thumbnail if exists
      const thumbnailPath = path.join(
        __dirname,
        "..",
        "uploads",
        "thumbnails",
        req.user.id,
        `${id}-thumb.jpg`
      );
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }

      // Update user's storage usage (subtract file size)
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { storageUsed: -item.size },
      });

      await File.findByIdAndDelete(id);
      res.json({ message: "Permanently deleted" });
    } else {
      // Move to trash
      item.trash = true;
      item.trashedAt = new Date();
      await item.save();
      res.json({ message: "Moved to trash" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore file from trash
router.post("/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only restore items you own" });
    }

    item.trash = false;
    item.trashedAt = null;
    await item.save();
    res.json({ message: "Restored successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file
router.put("/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only rename items you own" });
    }

    // Validate that file extension hasn't changed
    const getFileExtension = (filename) => {
      const lastDotIndex = filename.lastIndexOf(".");
      return lastDotIndex === -1 ? "" : filename.substring(lastDotIndex);
    };

    const originalExtension = getFileExtension(item.name);
    const newExtension = getFileExtension(name.trim());

    if (originalExtension !== newExtension) {
      return res.status(400).json({
        error: `File extension cannot be changed. Expected extension: ${
          originalExtension || "(none)"
        }`,
      });
    }

    // Check if file with same name exists in the same parent
    const existingFile = await File.findOne({
      name: name.trim(),
      parent: item.parent,
      owner: req.user.id,
      _id: { $ne: id },
      trash: { $ne: true },
    });

    if (existingFile) {
      return res
        .status(400)
        .json({ error: "A file with this name already exists" });
    }

    item.name = name.trim();
    await item.save();
    res.json({ message: "File renamed successfully", item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy file
router.post("/:id/copy", async (req, res) => {
  try {
    const { id } = req.params;
    const { parent, name } = req.body;

    const sourceFile = await File.findById(id);
    if (!sourceFile) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user has access to the source file
    const hasAccess =
      sourceFile.owner.toString() === req.user.id ||
      sourceFile.shared.includes(req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get user to check storage limits
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate storage availability before copying
    const storageError = validateStorageForUpload(user, sourceFile.size);
    if (storageError) {
      logger.warn("File copy rejected - Storage limit exceeded", {
        userId: req.user.id,
        fileName: sourceFile.name,
        fileSize: sourceFile.size,
      });
      return res.status(413).json(storageError);
    }

    // If parent is specified, check if user has access to target folder
    if (parent && parent !== "root") {
      const Folder = require("../models/Folder");
      const targetFolder = await Folder.findById(parent);
      if (!targetFolder) {
        return res.status(404).json({ error: "Target folder not found" });
      }

      const hasTargetAccess =
        targetFolder.owner.toString() === req.user.id ||
        targetFolder.shared.includes(req.user.id);
      if (!hasTargetAccess) {
        return res
          .status(403)
          .json({ error: "Access denied to target folder" });
      }
    }

    // Generate unique name if not provided
    let copyName = name || `Copy of ${sourceFile.name}`;
    let counter = 1;

    // Check for name conflicts and generate unique name
    while (
      await File.findOne({
        name: copyName,
        parent: parent === "root" ? null : parent,
        owner: req.user.id,
        trash: { $ne: true },
      })
    ) {
      copyName = name
        ? `${name} (${counter})`
        : `Copy of ${sourceFile.name} (${counter})`;
      counter++;
    }

    // Copy physical file
    const sourcePath = sourceFile.path;
    const newFileName = `${uuidv4()}-${copyName}`;
    const newPath = getUserFilePath(req.user.id, newFileName);

    // Ensure user directory exists
    ensureUserDir(req.user.id);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, newPath);
    }

    // Create new file record
    const newFile = new File({
      name: copyName,
      type: sourceFile.type,
      path: newPath,
      size: sourceFile.size,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
    });

    await newFile.save();

    // Update user's storage usage (add file size)
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { storageUsed: sourceFile.size },
    });

    // Send storage notification if threshold crossed (async, don't block response)
    handlePostUploadNotification(user, sourceFile.size).catch((error) => {
      logger.error("Failed to send storage notification after copy", {
        userId: req.user.id,
        error: error.message,
      });
    });

    // Send image files to Redis queue for processing (same as upload)
    if (redisQueue.isImageFile(sourceFile.type)) {
      redisQueue.sendImageJob({
        filePath: newPath,
        fileName: copyName,
        userId: req.user.id,
        mimetype: sourceFile.type,
      }).catch((error) => {
        logger.error("Failed to send copied image to processing queue", {
          userId: req.user.id,
          fileName: copyName,
          error: error.message,
        });
      });
    }

    res.json({ message: "File copied successfully", item: newFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move file
router.put("/:id/move", async (req, res) => {
  try {
    const { id } = req.params;
    const { parent } = req.body;

    const item = await File.findById(id);
    if (!item) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "You can only move items you own" });
    }

    // If moving to a specific folder, validate it exists and user has access
    if (parent && parent !== "root") {
      const Folder = require("../models/Folder");
      const targetFolder = await Folder.findById(parent);
      if (!targetFolder) {
        return res.status(404).json({ error: "Target folder not found" });
      }

      // Check if user owns the target folder or has write access
      if (targetFolder.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Access denied to target folder" });
      }
    }

    // Check if file with same name exists in target location
    const existingFile = await File.findOne({
      name: item.name,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
      _id: { $ne: id },
      trash: { $ne: true },
    });

    if (existingFile) {
      return res.status(400).json({
        error: "A file with this name already exists in the target location",
      });
    }

    item.parent = parent === "root" ? null : parent;
    await item.save();
    res.json({ message: "File moved successfully", item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CHUNKED UPLOAD ROUTES ==========

// Initiate chunked upload
router.post("/chunked-upload/initiate", async (req, res) => {
  try {
    const {
      fileName,
      fileSize,
      fileType,
      totalChunks,
      parentFolder,
      chunkSize,
    } = req.body;

    // Validate input
    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({
        error: "Missing required fields: fileName, fileSize, totalChunks",
      });
    }

    if (fileSize <= 0 || totalChunks <= 0) {
      return res.status(400).json({
        error: "Invalid fileSize or totalChunks",
      });
    }

    // Get user to check storage limits
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate storage availability before initiating upload
    const storageError = validateStorageForUpload(user, fileSize);
    if (storageError) {
      logger.warn(
        "Chunked upload initiation rejected - Storage limit exceeded",
        {
          userId: req.user.id,
          fileName,
          fileSize,
        }
      );
      return res.status(413).json(storageError);
    }

    // Check if parent folder exists (if specified)
    if (parentFolder && parentFolder !== "root") {
      const Folder = require("../models/Folder");
      const folder = await Folder.findById(parentFolder);
      if (!folder) {
        return res.status(404).json({ error: "Parent folder not found" });
      }

      // Check if user has access to the folder
      if (
        folder.owner.toString() !== req.user.id &&
        !folder.shared.includes(req.user.id)
      ) {
        return res
          .status(403)
          .json({ error: "Access denied to parent folder" });
      }
    }

    // Generate upload session
    const uploadId = generateUploadId();
    const tempDir = createTempUploadDir(req.user.id, uploadId);

    const uploadSession = new UploadSession({
      uploadId,
      fileName,
      fileSize,
      fileType: fileType || "application/octet-stream",
      totalChunks,
      chunkSize: CHUNK_SIZE,
      parentFolder: parentFolder === "root" ? null : parentFolder,
      owner: req.user.id,
      tempDirectory: tempDir,
      metadata: {
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
      },
    });

    await uploadSession.save();

    res.json({
      uploadId,
      message: "Upload session initiated successfully",
      session: {
        uploadId,
        fileName,
        fileSize,
        totalChunks,
        chunkSize: uploadSession.chunkSize,
      },
    });
  } catch (error) {
    logger.logError(error, "Error initiating chunked upload");
    res.status(500).json({ error: error.message });
  }
});

// Upload a chunk - Configure multer for chunked uploads
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CHUNK_SIZE,
    fieldSize: MAX_CHUNK_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Accept any file type for chunks
    cb(null, true);
  },
});

router.post(
  "/chunked-upload/:uploadId/chunk",
  chunkUpload.single("chunk"),
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { uploadId } = req.params;
      const { index, size, start, end, hash } = req.body;
      const chunkFile = req.file;

      if (!chunkFile) {
        return res.status(400).json({ error: "No chunk file provided" });
      }

      // Find upload session with timeout protection
      const sessionTimeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Session lookup timeout")),
          SESSION_LOOKUP_TIMEOUT
        )
      );

      const sessionPromise = UploadSession.findOne({
        uploadId,
        owner: req.user.id,
        status: { $in: ["initiated", "uploading", "paused"] },
      });

      const session = await Promise.race([sessionPromise, sessionTimeout]);

      if (!session) {
        return res
          .status(404)
          .json({ error: "Upload session not found or expired" });
      }

      // Check if upload is paused
      if (session.status === "paused") {
        return res.status(409).json({
          error: "Upload is paused",
          status: "paused",
          canResume: true,
        });
      }

      // Validate chunk data
      const chunkIndex = parseInt(index);
      const chunkSize = parseInt(size);
      const startByte = parseInt(start);
      const endByte = parseInt(end);

      if (
        isNaN(chunkIndex) ||
        chunkIndex < 0 ||
        chunkIndex >= session.totalChunks
      ) {
        logger.error(
          `Invalid chunk index ${chunkIndex} for session ${uploadId}`
        );
        return res.status(400).json({ error: "Invalid chunk index" });
      }

      if (chunkSize !== chunkFile.buffer.length) {
        logger.error(
          `Chunk size mismatch. Expected: ${chunkSize}, Got: ${chunkFile.buffer.length}`
        );
        return res.status(400).json({ error: "Chunk size mismatch" });
      }

      // Check if chunk already exists to avoid duplicates
      const existingChunk = session.uploadedChunks.find(
        (c) => c.index === chunkIndex
      );
      if (existingChunk) {
        const progress =
          (session.uploadedChunks.length / session.totalChunks) * 100;
        return res.json({
          message: "Chunk already uploaded",
          chunkIndex,
          progress: Math.round(progress * 100) / 100,
          uploadedChunks: session.uploadedChunks.length,
          totalChunks: session.totalChunks,
          isComplete: session.isComplete(),
        });
      }

      // Store chunk to temporary storage with error handling
      let chunkPath;
      try {
        chunkPath = await storeChunk(
          session.tempDirectory,
          chunkIndex,
          chunkFile.buffer
        );
      } catch (storageError) {
        logger.logError(storageError, `Failed to store chunk ${chunkIndex}`);
        return res.status(500).json({ error: "Failed to store chunk" });
      }

      // Verify chunk integrity if hash provided
      if (hash) {
        try {
          const isValid = await verifyChunkIntegrity(chunkPath, hash);
          if (!isValid) {
            // Remove invalid chunk
            fs.unlinkSync(chunkPath);
            logger.error(
              `Chunk integrity verification failed for chunk ${chunkIndex}`
            );
            return res
              .status(400)
              .json({ error: "Chunk integrity verification failed" });
          }
        } catch (verificationError) {
          logger.logError(
            verificationError,
            `Chunk verification error for chunk ${chunkIndex}`
          );
          // Continue without verification if verification fails
        }
      }

      // Add chunk to session with optimized performance
      try {
        const addResult = await session.addChunk({
          index: chunkIndex,
          size: chunkSize,
          hash: hash || "",
          startByte,
          endByte,
          uploadedAt: new Date(),
        });

        // No need for post-verification query - trust the atomic operation
        // If addResult.success is true, the chunk was added or already existed
      } catch (dbError) {
        logger.error(
          `Failed to add chunk ${chunkIndex} to session: ${dbError.message}`
        );

        // Clean up stored chunk on database error
        if (fs.existsSync(chunkPath)) {
          try {
            fs.unlinkSync(chunkPath);
          } catch (unlinkError) {
            logger.logError(
              unlinkError,
              `Failed to cleanup chunk file ${chunkPath}`
            );
          }
        }

        // Return specific error for version conflicts to help client retry
        if (
          dbError.name === "VersionError" ||
          dbError.codeName === "WriteConflict" ||
          dbError.code === 11000
        ) {
          return res.status(409).json({
            error: "Concurrent update conflict - please retry",
            retryable: true,
            chunkIndex,
          });
        }

        return res.status(500).json({
          error: "Failed to update upload session",
          retryable: true,
          chunkIndex,
          details: dbError.message,
        });
      }

      // Update session status atomically if needed (only once)
      if (session.status === "initiated") {
        try {
          await UploadSession.findByIdAndUpdate(
            session._id,
            { status: "uploading" },
            { new: false }
          );
          session.status = "uploading";
        } catch (saveError) {
          logger.error(`Failed to update session status: ${saveError.message}`);
          // Don't fail the request for this error
        }
      }

      // Use aggregation for efficient progress calculation without fetching full array
      const progressData = await UploadSession.aggregate([
        { $match: { _id: session._id } },
        {
          $project: {
            uploadedCount: { $size: "$uploadedChunks" },
            totalChunks: 1,
          },
        },
      ]);

      const uploadedCount = progressData[0]?.uploadedCount || 0;
      const progress = (uploadedCount / session.totalChunks) * 100;

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      res.json({
        message: "Chunk uploaded successfully",
        chunkIndex,
        progress: Math.round(progress * 100) / 100,
        uploadedChunks: uploadedCount,
        totalChunks: session.totalChunks,
        isComplete: uploadedCount === session.totalChunks,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(
        `Error uploading chunk (${processingTime}ms): ${error.message}`
      );
      if (error.stack) logger.debug(error.stack);

      // Send appropriate error response based on error type
      if (error.message === "Session lookup timeout") {
        res.status(408).json({ error: "Session lookup timeout" });
      } else if (error.name === "ValidationError") {
        res.status(400).json({ error: "Invalid chunk data" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// Complete chunked upload
router.post("/chunked-upload/:uploadId/complete", async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { fileName, totalChunks, chunks } = req.body;

    // Find upload session
    const session = await UploadSession.findOne({
      uploadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    // Validate all chunks are uploaded
    const validation = validateChunkSequence(
      session.uploadedChunks,
      session.totalChunks
    );
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Upload incomplete",
        missingChunks: validation.missingChunks,
        duplicateChunks: validation.duplicateChunks,
      });
    }

    // Generate final file path
    const finalFileName = fileName || session.fileName;
    const finalFilePath = getFinalFilePath(req.user.id, finalFileName);

    try {
      // Combine chunks into final file
      await combineChunks(
        session.tempDirectory,
        session.totalChunks,
        finalFilePath
      );

      // Calculate file hash for verification
      const fileHash = await calculateFileHash(finalFilePath);

      // Verify final file size
      const fileStats = fs.statSync(finalFilePath);
      if (fileStats.size !== session.fileSize) {
        fs.unlinkSync(finalFilePath); // Clean up incomplete file
        throw new Error(
          `File size mismatch. Expected: ${session.fileSize}, Got: ${fileStats.size}`
        );
      }

      // Calculate upload statistics
      const uploadStats = calculateUploadStats(session);

      // Create file record
      const file = new File({
        name: finalFileName,
        type: session.fileType || path.extname(finalFileName),
        path: finalFilePath,
        size: session.fileSize,
        parent: session.parentFolder,
        owner: req.user.id,
        uploadMetadata: {
          uploadId: session.uploadId,
          isChunkedUpload: true,
          totalChunks: session.totalChunks,
          chunkSize: session.chunkSize,
          checksums: {
            sha256: fileHash,
          },
          uploadStats: {
            totalRetries: session.metadata.totalRetries || 0,
            uploadDuration: uploadStats.duration,
            averageSpeed: uploadStats.averageSpeed,
          },
        },
      });

      await file.save();

      // Update user's storage usage
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { storageUsed: session.fileSize },
      });

      // Get updated user to send notification
      const user = await User.findById(req.user.id);

      // Send storage notification if threshold crossed (async, don't block response)
      handlePostUploadNotification(user, session.fileSize).catch((error) => {
        logger.error("Failed to send storage notification", {
          userId: req.user.id,
          error: error.message,
        });
      });

      // Send image files to Redis queue for processing
      if (redisQueue.isImageFile(session.fileType)) {
        redisQueue.sendImageJob({
          filePath: finalFilePath,
          fileName: finalFileName,
          userId: req.user.id,
          mimetype: session.fileType,
        }).catch((error) => {
          logger.error("Failed to send image to processing queue", {
            userId: req.user.id,
            fileName: finalFileName,
            error: error.message,
          });
        });
      }

      // Update session
      session.status = "completed";
      session.completedAt = new Date();
      session.finalFileId = file._id;
      await session.save();

      // Clean up temporary directory
      cleanupTempDir(session.tempDirectory);

      res.json({
        message: "File uploaded successfully",
        file: file,
        uploadStats: {
          duration: uploadStats.duration,
          averageSpeed: uploadStats.averageSpeed,
          totalRetries: session.metadata.totalRetries || 0,
        },
      });
    } catch (combineError) {
      // Clean up on failure
      if (fs.existsSync(finalFilePath)) {
        fs.unlinkSync(finalFilePath);
      }

      session.status = "failed";
      await session.save();

      throw combineError;
    }
  } catch (error) {
    logger.logError(error, "Error completing chunked upload");
    res.status(500).json({ error: error.message });
  }
});

// Get upload session status
router.get("/chunked-upload/:uploadId/status", async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      uploadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    // Use aggregation for efficient status calculation
    const statusData = await UploadSession.aggregate([
      { $match: { _id: session._id } },
      {
        $project: {
          status: 1,
          fileName: 1,
          fileSize: 1,
          totalChunks: 1,
          createdAt: 1,
          completedAt: 1,
          expiresAt: 1,
          uploadedIndices: "$uploadedChunks.index",
          uploadedCount: { $size: "$uploadedChunks" },
          uploadedBytes: { $sum: "$uploadedChunks.size" },
        },
      },
    ]);

    const data = statusData[0];
    const progress = (data.uploadedCount / data.totalChunks) * 100;

    // Calculate missing chunks efficiently
    const uploadedSet = new Set(data.uploadedIndices);
    const missingChunks = [];
    for (let i = 0; i < data.totalChunks; i++) {
      if (!uploadedSet.has(i)) {
        missingChunks.push(i);
      }
    }

    res.json({
      uploadId,
      status: data.status,
      fileName: data.fileName,
      fileSize: data.fileSize,
      totalChunks: data.totalChunks,
      uploadedChunks: data.uploadedIndices,
      missingChunks,
      progress: Math.round(progress * 100) / 100,
      uploadedBytes: data.uploadedBytes,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      expiresAt: data.expiresAt,
    });
  } catch (error) {
    logger.logError(error, "Error getting upload status");
    res.status(500).json({ error: error.message });
  }
});

// Cancel chunked upload
router.delete("/chunked-upload/:uploadId", async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      uploadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    // Clean up temporary directory
    cleanupTempDir(session.tempDirectory);

    // Update session status
    session.status = "cancelled";
    await session.save();

    res.json({ message: "Upload cancelled successfully" });
  } catch (error) {
    logger.logError(error, "Error cancelling upload");
    res.status(500).json({ error: error.message });
  }
});

// Pause chunked upload
router.post("/chunked-upload/:uploadId/pause", async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      uploadId,
      owner: req.user.id,
      status: { $in: ["initiated", "uploading"] },
    });

    if (!session) {
      return res.status(404).json({
        error: "Upload session not found or already completed",
      });
    }

    // Update session status to paused
    session.status = "paused";
    await session.save();

    res.json({
      message: "Upload paused successfully",
      uploadId,
      status: "paused",
    });
  } catch (error) {
    logger.logError(error, "Error pausing upload");
    res.status(500).json({ error: error.message });
  }
});

// Resume chunked upload
router.post("/chunked-upload/:uploadId/resume", async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      uploadId,
      owner: req.user.id,
      status: "paused",
    });

    if (!session) {
      return res.status(404).json({
        error: "Upload session not found or not paused",
      });
    }

    // Resume upload by setting status back to uploading
    session.status = "uploading";
    await session.save();

    // Return missing chunks for client to resume
    const missingChunks = session.getMissingChunks();

    res.json({
      message: "Upload resumed successfully",
      uploadId,
      status: "uploading",
      missingChunks,
      progress:
        Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 10000
        ) / 100,
    });
  } catch (error) {
    logger.logError(error, "Error resuming upload");
    res.status(500).json({ error: error.message });
  }
});

// List active upload sessions for user
router.get("/chunked-upload/sessions", async (req, res) => {
  try {
    const sessions = await UploadSession.find({
      owner: req.user.id,
      status: { $in: ["initiated", "uploading"] },
    }).sort({ createdAt: -1 });

    const sessionData = sessions.map((session) => ({
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      status: session.status,
      progress:
        Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 10000
        ) / 100,
      uploadedBytes: session.getTotalUploadedBytes(),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));

    res.json({ sessions: sessionData });
  } catch (error) {
    logger.logError(error, "Error listing upload sessions");
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint for chunked uploads
router.get("/chunked-upload/health", async (req, res) => {
  try {
    const stats = await UploadSession.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
        },
      },
    ]);

    res.json({
      status: "healthy",
      timestamp: new Date(),
      uploadSessions: stats,
      serverMemory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
    });
  } catch (error) {
    logger.logError(error, "Health check error");
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date(),
    });
  }
});

// ========== CHUNKED DOWNLOAD ROUTES ==========

/**
 * Initiate a chunked download session
 * POST /files/chunked-download/initiate
 * Body: { fileId }
 */
router.post("/chunked-download/initiate", async (req, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    // Find the file and verify access
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if user has access to the file
    const hasAccess =
      file.owner.toString() === req.user.id ||
      file.shared.includes(req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Verify file exists on disk
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Calculate total chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Generate download session
    const downloadId = DownloadSession.generateDownloadId();

    const downloadSession = new DownloadSession({
      downloadId,
      fileId: file._id,
      fileName: file.name,
      fileSize: file.size,
      filePath: file.path,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      owner: req.user.id,
      status: "active",
      metadata: {
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
      },
    });

    await downloadSession.save();

    logger.info("Chunked download initiated", {
      downloadId,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      userId: req.user.id,
    });

    res.json({
      downloadId,
      message: "Download session initiated successfully",
      session: {
        downloadId,
        fileId: file._id,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        chunkSize: CHUNK_SIZE,
      },
    });
  } catch (error) {
    logger.logError(error, "Error initiating chunked download");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Download a specific chunk
 * GET /files/chunked-download/:downloadId/chunk/:chunkIndex
 */
router.get("/chunked-download/:downloadId/chunk/:chunkIndex", async (req, res) => {
  try {
    const { downloadId, chunkIndex } = req.params;
    const index = parseInt(chunkIndex);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({ error: "Invalid chunk index" });
    }

    // Find download session
    const session = await DownloadSession.findOne({
      downloadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Download session not found" });
    }

    // Check if download is paused or cancelled
    if (session.status === "paused") {
      return res.status(409).json({
        error: "Download is paused",
        status: "paused",
        canResume: true,
      });
    }

    if (session.status === "cancelled") {
      return res.status(410).json({
        error: "Download session was cancelled",
        status: "cancelled",
      });
    }

    if (session.status === "completed") {
      return res.status(400).json({
        error: "Download already completed",
        status: "completed",
      });
    }

    // Validate chunk index
    if (index >= session.totalChunks) {
      return res.status(400).json({ error: "Chunk index out of range" });
    }

    // Check if chunk was already downloaded (idempotent support)
    const existingChunk = session.downloadedChunks.find((c) => c.index === index);

    // Calculate byte range
    const startByte = index * session.chunkSize;
    const endByte = Math.min(startByte + session.chunkSize - 1, session.fileSize - 1);
    const chunkSize = endByte - startByte + 1;

    // Verify file still exists
    if (!fs.existsSync(session.filePath)) {
      session.status = "failed";
      await session.save();
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Set headers for chunk download
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": chunkSize,
      "Content-Range": `bytes ${startByte}-${endByte}/${session.fileSize}`,
      "X-Chunk-Index": index,
      "X-Total-Chunks": session.totalChunks,
      "X-Download-Id": downloadId,
      "Cache-Control": "no-store",
    });

    // Create read stream for the specific byte range
    const stream = fs.createReadStream(session.filePath, {
      start: startByte,
      end: endByte,
      highWaterMark: 64 * 1024, // 64KB buffer
    });

    // Handle stream errors
    stream.on("error", (err) => {
      logger.logError(err, "Error streaming chunk", {
        downloadId,
        chunkIndex: index,
      });
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming chunk" });
      }
    });

    // Track when chunk download completes
    stream.on("end", async () => {
      try {
        // Mark chunk as downloaded (if not already)
        if (!existingChunk) {
          await session.markChunkDownloaded({
            index,
            size: chunkSize,
            startByte,
            endByte,
          });
        }

        // Check if download is complete
        const updatedSession = await DownloadSession.findById(session._id);
        if (updatedSession.isComplete() && updatedSession.status !== "completed") {
          updatedSession.status = "completed";
          updatedSession.completedAt = new Date();
          await updatedSession.save();

          logger.info("Chunked download completed", {
            downloadId,
            fileName: session.fileName,
            totalChunks: session.totalChunks,
            userId: req.user.id,
          });
        }
      } catch (updateError) {
        logger.logError(updateError, "Error updating chunk status");
      }
    });

    // Pipe stream to response
    stream.pipe(res);
  } catch (error) {
    logger.logError(error, "Error downloading chunk");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get download session status
 * GET /files/chunked-download/:downloadId/status
 */
router.get("/chunked-download/:downloadId/status", async (req, res) => {
  try {
    const { downloadId } = req.params;

    const session = await DownloadSession.findOne({
      downloadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Download session not found" });
    }

    // Calculate progress
    const downloadedChunks = session.downloadedChunks.length;
    const progress = (downloadedChunks / session.totalChunks) * 100;
    const downloadedBytes = session.downloadedChunks.reduce(
      (sum, c) => sum + c.size,
      0
    );

    res.json({
      downloadId,
      status: session.status,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      downloadedChunks,
      downloadedBytes,
      progress: Math.round(progress * 100) / 100,
      missingChunks: session.getMissingChunks(),
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    logger.logError(error, "Error getting download status");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pause a chunked download
 * POST /files/chunked-download/:downloadId/pause
 */
router.post("/chunked-download/:downloadId/pause", async (req, res) => {
  try {
    const { downloadId } = req.params;

    const session = await DownloadSession.findOne({
      downloadId,
      owner: req.user.id,
      status: "active",
    });

    if (!session) {
      return res.status(404).json({
        error: "Download session not found or not active",
      });
    }

    // Update session status to paused
    session.status = "paused";
    session.pausedAt = new Date();
    await session.save();

    logger.info("Chunked download paused", {
      downloadId,
      fileName: session.fileName,
      progress: (session.downloadedChunks.length / session.totalChunks) * 100,
      userId: req.user.id,
    });

    res.json({
      message: "Download paused successfully",
      downloadId,
      status: "paused",
      progress:
        Math.round(
          (session.downloadedChunks.length / session.totalChunks) * 10000
        ) / 100,
    });
  } catch (error) {
    logger.logError(error, "Error pausing download");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resume a paused chunked download
 * POST /files/chunked-download/:downloadId/resume
 */
router.post("/chunked-download/:downloadId/resume", async (req, res) => {
  try {
    const { downloadId } = req.params;

    const session = await DownloadSession.findOne({
      downloadId,
      owner: req.user.id,
      status: "paused",
    });

    if (!session) {
      return res.status(404).json({
        error: "Download session not found or not paused",
      });
    }

    // Resume download
    session.status = "active";
    session.metadata.resumeCount = (session.metadata.resumeCount || 0) + 1;
    delete session.pausedAt;
    await session.save();

    // Get missing chunks for client to resume
    const missingChunks = session.getMissingChunks();

    logger.info("Chunked download resumed", {
      downloadId,
      fileName: session.fileName,
      missingChunks: missingChunks.length,
      resumeCount: session.metadata.resumeCount,
      userId: req.user.id,
    });

    res.json({
      message: "Download resumed successfully",
      downloadId,
      status: "active",
      missingChunks,
      downloadedChunks: session.downloadedChunks.map((c) => c.index),
      progress:
        Math.round(
          (session.downloadedChunks.length / session.totalChunks) * 10000
        ) / 100,
    });
  } catch (error) {
    logger.logError(error, "Error resuming download");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a chunked download
 * POST /files/chunked-download/:downloadId/cancel
 */
router.post("/chunked-download/:downloadId/cancel", async (req, res) => {
  try {
    const { downloadId } = req.params;

    const session = await DownloadSession.findOne({
      downloadId,
      owner: req.user.id,
      status: { $in: ["active", "paused"] },
    });

    if (!session) {
      return res.status(404).json({
        error: "Download session not found or already completed/cancelled",
      });
    }

    // Mark as cancelled
    session.status = "cancelled";
    await session.save();

    logger.info("Chunked download cancelled", {
      downloadId,
      fileName: session.fileName,
      downloadedChunks: session.downloadedChunks.length,
      userId: req.user.id,
    });

    res.json({
      message: "Download cancelled successfully",
      downloadId,
      status: "cancelled",
    });
  } catch (error) {
    logger.logError(error, "Error cancelling download");
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a download session (cleanup)
 * DELETE /files/chunked-download/:downloadId
 */
router.delete("/chunked-download/:downloadId", async (req, res) => {
  try {
    const { downloadId } = req.params;

    const session = await DownloadSession.findOneAndDelete({
      downloadId,
      owner: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ error: "Download session not found" });
    }

    logger.info("Download session deleted", {
      downloadId,
      fileName: session.fileName,
      userId: req.user.id,
    });

    res.json({ message: "Download session deleted successfully" });
  } catch (error) {
    logger.logError(error, "Error deleting download session");
    res.status(500).json({ error: error.message });
  }
});

/**
 * List active download sessions for user
 * GET /files/chunked-download/sessions
 */
router.get("/chunked-download/sessions", async (req, res) => {
  try {
    const sessions = await DownloadSession.find({
      owner: req.user.id,
      status: { $in: ["active", "paused"] },
    }).sort({ createdAt: -1 });

    const sessionData = sessions.map((session) => ({
      downloadId: session.downloadId,
      fileId: session.fileId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      status: session.status,
      progress:
        Math.round(
          (session.downloadedChunks.length / session.totalChunks) * 10000
        ) / 100,
      downloadedBytes: session.downloadedChunks.reduce(
        (sum, c) => sum + c.size,
        0
      ),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));

    res.json({ sessions: sessionData });
  } catch (error) {
    logger.logError(error, "Error listing download sessions");
    res.status(500).json({ error: error.message });
  }
});

/**
 * ========================================
 * MULTI-FILE/FOLDER DOWNLOAD ENDPOINT
 * ========================================
 * 
 * Production-grade ZIP streaming for downloading multiple files and folders
 * 
 * Features:
 * - Streams ZIP on-the-fly (no temp files)
 * - Recursive folder traversal
 * - Preserves directory structure
 * - Memory-efficient streaming
 * - Permission validation
 * - Client disconnect handling
 * - Size limit enforcement
 * - Comprehensive error handling
 * 
 * Request body:
 * {
 *   "files": ["fileId1", "fileId2"],
 *   "folders": ["folderId1", "folderId2"]
 * }
 */

const ZipStreamService = require("../utils/zipStreamService");
const DownloadHelpers = require("../utils/downloadHelpers");
const { body, validationResult } = require("express-validator");

// Configuration
const MAX_DOWNLOAD_SIZE = process.env.MAX_DOWNLOAD_SIZE 
  ? parseInt(process.env.MAX_DOWNLOAD_SIZE) 
  : 5 * 1024 * 1024 * 1024; // 5GB default

const DOWNLOAD_TIMEOUT = process.env.DOWNLOAD_TIMEOUT
  ? parseInt(process.env.DOWNLOAD_TIMEOUT)
  : 30 * 60 * 1000; // 30 minutes default

router.post(
  "/download",
  [
    body("files")
      .optional()
      .isArray()
      .withMessage("files must be an array"),
    body("folders")
      .optional()
      .isArray()
      .withMessage("folders must be an array"),
  ],
  async (req, res) => {
    const startTime = Date.now();
    let archive = null;
    let filesProcessed = 0;

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Download validation failed", {
          userId: req.user.id,
          errors: errors.array(),
        });
        return res.status(400).json({ 
          error: "Invalid request", 
          details: errors.array() 
        });
      }

      const { files = [], folders = [] } = req.body;

      // Validate at least one item selected
      if (files.length === 0 && folders.length === 0) {
        logger.warn("Download attempted with no items", {
          userId: req.user.id,
        });
        return res.status(400).json({ 
          error: "No files or folders selected" 
        });
      }

      // Validate reasonable selection size
      const totalItems = files.length + folders.length;
      if (totalItems > 1000) {
        logger.warn("Download selection too large", {
          userId: req.user.id,
          totalItems,
        });
        return res.status(400).json({ 
          error: "Too many items selected (max 1000)" 
        });
      }

      logger.info("Multi-download initiated", {
        userId: req.user.id,
        fileCount: files.length,
        folderCount: folders.length,
        ip: req.ip,
      });

      // Resolve all files from selection (with permission checks)
      const resolution = await DownloadHelpers.resolveDownloadSelection(
        files,
        folders,
        req.user.id
      );

      const { 
        files: resolvedFiles, 
        totalSize, 
        totalFiles, 
        errors: resolutionErrors,
        folderNames 
      } = resolution;

      // Check if any files were resolved
      if (resolvedFiles.length === 0) {
        logger.warn("No accessible files found for download", {
          userId: req.user.id,
          errors: resolutionErrors,
        });
        return res.status(404).json({ 
          error: "No accessible files found",
          details: resolutionErrors
        });
      }

      // Check size limit
      if (MAX_DOWNLOAD_SIZE > 0 && totalSize > MAX_DOWNLOAD_SIZE) {
        logger.warn("Download size exceeds limit", {
          userId: req.user.id,
          totalSize,
          maxSize: MAX_DOWNLOAD_SIZE,
          formattedSize: DownloadHelpers.formatSize(totalSize),
          formattedMax: DownloadHelpers.formatSize(MAX_DOWNLOAD_SIZE),
        });
        return res.status(413).json({ 
          error: "Download size exceeds limit",
          totalSize: DownloadHelpers.formatSize(totalSize),
          maxSize: DownloadHelpers.formatSize(MAX_DOWNLOAD_SIZE),
        });
      }

      // Generate ZIP filename
      const zipFilename = DownloadHelpers.generateZipFilename(
        files,
        folders,
        folderNames
      );

      logger.info("Starting ZIP stream", {
        userId: req.user.id,
        zipFilename,
        totalFiles,
        totalSize: DownloadHelpers.formatSize(totalSize),
        resolutionErrors: resolutionErrors.length,
      });

      // Set download timeout
      req.setTimeout(DOWNLOAD_TIMEOUT);

      // Create ZIP stream
      archive = ZipStreamService.createZipStream(res, zipFilename, {
        compressionLevel: 6,
        comment: `MyDrive archive - ${totalFiles} file(s)`,
      });

      // Handle client disconnect - returns abort checker
      const disconnectHandler = ZipStreamService.handleClientDisconnect(req, archive, () => {
        logger.warn("Client disconnected during multi-file download", {
          userId: req.user.id,
          zipFilename,
          filesProcessed,
          totalFiles,
        });
      });

      // Add all files to ZIP
      for (const fileEntry of resolvedFiles) {
        // Check if client disconnected - stop processing immediately
        if (disconnectHandler.isAborted()) {
          logger.info("Stopping file processing - client disconnected", {
            userId: req.user.id,
            filesProcessed,
            totalFiles,
          });
          break;
        }
        
        try {
          await ZipStreamService.addFileToZip(
            archive,
            fileEntry.filePath,
            fileEntry.zipPath
          );
          filesProcessed++;
        } catch (error) {
          // Check if error is due to client disconnect
          if (disconnectHandler.isAborted()) {
            logger.info("File processing stopped due to client disconnect", {
              userId: req.user.id,
              filesProcessed,
              totalFiles,
            });
            break;
          }
          
          logger.error("Error adding file to ZIP", {
            userId: req.user.id,
            fileId: fileEntry.fileDoc._id,
            fileName: fileEntry.fileDoc.name,
            error: error.message,
          });
          // Continue with other files
        }
      }

      // Only finalize if client is still connected
      if (!disconnectHandler.isAborted()) {
        // Finalize ZIP
        await ZipStreamService.finalizeZip(archive);

        const duration = Date.now() - startTime;

        logger.info("Multi-download completed", {
          userId: req.user.id,
          zipFilename,
          filesProcessed,
          totalFiles,
          totalSize: DownloadHelpers.formatSize(totalSize),
          duration: `${(duration / 1000).toFixed(2)}s`,
          avgSpeed: DownloadHelpers.formatSize(totalSize / (duration / 1000)) + "/s",
          ip: req.ip,
        });
      } else {
        logger.info("Multi-download aborted by client", {
          userId: req.user.id,
          zipFilename,
          filesProcessed,
          totalFiles,
          ip: req.ip,
        });
      }

      // Note: Response is already sent via stream
    } catch (error) {
      logger.error("Multi-download failed", {
        userId: req.user.id,
        filesProcessed,
        error: error.message,
        stack: error.stack,
        ip: req.ip,
      });

      // Abort archive if it exists
      if (archive && !archive.destroyed) {
        archive.abort();
        archive.destroy();
      }

      // Only send error response if headers not sent
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Download failed",
          message: error.message
        });
      }
    }
  }
);

module.exports = router;
