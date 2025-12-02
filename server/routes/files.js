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
const { ensureUserDir, getUserFilePath } = require("../utils/fileHelpers");
const emailService = require("../utils/emailService");
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
    const { parent } = req.body;
    const file = new File({
      name: req.file.originalname,
      type: path.extname(req.file.originalname),
      path: req.file.path,
      size: req.file.size,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
    });
    await file.save();

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

// Download file
router.get("/download/:fileId", async (req, res) => {
  const startTime = Date.now();
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
        logger.logError(conversionError, {
          operation: "HEIC-conversion",
          userId: req.user.id,
          additionalInfo: file.name,
        });
        // Fallback to original file if conversion fails
        res.download(file.path, file.name);
      }
    } else {
      logger.logFileOperation("download", file, req.user.id, {
        fileSize: file.size,
        duration: Date.now() - startTime,
        ip: req.ip,
      });
      res.download(file.path, file.name);
    }
  } catch (error) {
    logger.logError(error, {
      operation: "download",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.params.fileId,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get thumbnail for preview (optimized with caching)
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

    // Create thumbnail cache directory
    const thumbnailDir = path.join(
      __dirname,
      "..",
      "uploads",
      "thumbnails",
      req.user.id
    );

    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Generate thumbnail filename based on file ID
    const thumbnailPath = path.join(
      thumbnailDir,
      `${req.params.fileId}-thumb.jpg`
    );

    // Check if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      res.set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      });
      return res.sendFile(path.resolve(thumbnailPath));
    }

    // Generate thumbnail (max 400px width, maintaining aspect ratio)
    try {
      await sharp(file.path)
        .rotate() // Auto-rotate based on EXIF
        .resize(400, 400, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, progressive: true })
        .toFile(thumbnailPath);

      // Serve the newly created thumbnail
      res.set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      });
      res.sendFile(path.resolve(thumbnailPath));
    } catch (conversionError) {
      logger.logError(conversionError, "Error generating thumbnail");
      // Fallback: send converted JPEG directly without caching
      try {
        const buffer = await sharp(file.path)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();

        res.set({
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000",
        });
        res.send(buffer);
      } catch (fallbackError) {
        logger.logError(fallbackError, "Fallback conversion failed");
        res.status(500).json({ error: "Failed to generate thumbnail" });
      }
    }
  } catch (error) {
    logger.logError(error, "Error in thumbnail route");
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
        type: path.extname(finalFileName),
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

module.exports = router;
