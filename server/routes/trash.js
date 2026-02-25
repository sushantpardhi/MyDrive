const express = require("express");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const logger = require("../utils/logger");

// Empty trash
router.delete("/empty", async (req, res) => {
  try {
    const userId = req.user.id;

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

      // Delete thumbnail if exists
      const thumbnailPath = path.join(
        __dirname,
        "..",
        "uploads",
        "thumbnails",
        userId,
        `${file._id}-thumb.jpg`,
      );
      if (fs.existsSync(thumbnailPath)) {
        try {
          fs.unlinkSync(thumbnailPath);
        } catch (err) {
          // Ignore thumbnail deletion errors
        }
      }

      freedSpace += file.size;
      await File.findByIdAndDelete(file._id);
      deletedFilesCount++;
    }

    // 4. Delete folders
    // For folders, we need to be careful. Ideally, if a folder is in trash, its contents are also in trash (handled by moveToTrash logic).
    // But if we just delete the folder doc, we might leave orphaned files if they weren't marked correctly?
    // The markFolderTrashState in folders.js marks descendants.
    // So all descendants should be trash: true.
    // However, the `trashedFiles` query above `File.find({ owner: userId, trash: true })` should catch all files even those inside trashed folders.
    // So we don't need recursive deletion logic here IF the data is consistent.
    // BUT, `deleteFilesRecursively` in folders.js exists for permanent delete.
    // Let's look at `deleteFilesRecursively` in `server/routes/folders.js` (imported from shareHelpers?). No, it's imported from shareHelpers in folders.js?
    // Wait, lines 8-12 of folders.js:
    // } = require("../utils/shareHelpers");
    // Let's verify what `deleteFilesRecursively` does.
    // If I delete a file via `trashedFiles` loop, I am good.
    // The only thing is empty folders or folders containing subfolders.
    // `trashedFolders` will get all folders.
    // If I delete all `trashedFiles` and `trashedFolders`, I should be good.

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
      deletedFiles: deletedFilesCount,
      deletedFolders: deletedFoldersCount,
      freedSpace,
    });

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
