const express = require("express");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const router = express.Router();
const logger = require("../utils/logger");
const redisCache = require("../utils/redisCache");

// Empty trash
router.delete("/empty", async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Password is required for security
    if (!password) {
      logger.warn("Empty trash attempted without password", { userId });
      return res.status(400).json({ error: "Password is required" });
    }

    // Get user and verify password
    const user = await User.findById(userId);
    if (!user) {
      logger.error("User not found for trash deletion", { userId });
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Empty trash - Incorrect password", {
        userId,
        email: user.email,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Incorrect password" });
    }

    // 1. Find all trashed files owned by user
    const trashedFiles = await File.find({ owner: userId, trash: true });

    // 2. Find all trashed folders owned by user
    const trashedFolders = await Folder.find({ owner: userId, trash: true });

    let freedSpace = 0;
    let deletedFilesCount = 0;
    let deletedFoldersCount = 0;

    // 3. Delete files
    for (const file of trashedFiles) {
      // Physical deletion
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.warn(`Failed to delete file from disk: ${file.path}`, {
            error: err.message,
          });
        }
      }

      // Delete worker-processed files if they exist (thumbnail, blur, low-quality)
      const fileName = path.basename(file.path, path.extname(file.path));
      const userDir = path.dirname(file.path);
      const processedDir = path.join(userDir, "processed");

      const processedFiles = [
        `${fileName}_thumbnail.webp`,
        `${fileName}_blur.webp`,
        `${fileName}_low-quality.webp`,
      ];

      processedFiles.forEach((pFile) => {
        const filePath = path.join(processedDir, pFile);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            // Ignore processed file deletion errors
          }
        }
      });

      freedSpace += file.size;
      await File.findByIdAndDelete(file._id);
      deletedFilesCount++;
    }

    // 4. Delete folders
    for (const folder of trashedFolders) {
      await Folder.findByIdAndDelete(folder._id);
      deletedFoldersCount++;
    }

    // 5. Update user storage usage
    if (freedSpace > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { storageUsed: -freedSpace },
      });
    }

    logger.info("Trash emptied successfully", {
      userId,
      email: user.email,
      deletedFiles: deletedFilesCount,
      deletedFolders: deletedFoldersCount,
      freedSpace,
    });

    // Invalidate user cache on emptying trash
    redisCache.invalidateUserCache(userId);

    res.json({
      message: "Trash emptied successfully",
      deletedFiles: deletedFilesCount,
      deletedFolders: deletedFoldersCount,
      freedSpace,
    });
  } catch (error) {
    logger.logError(error, {
      operation: "empty-trash",
      userId: req.user.id,
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
