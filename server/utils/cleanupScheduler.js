const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");
const DownloadSession = require("../models/DownloadSession");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Initialize cleanup scheduler
 */
const initializeCleanupScheduler = () => {
  logger.info("🗑️  Cleanup scheduler initialized - Running every hour");

  // Run cleanup every hour (0 * * * *)
  cron.schedule("0 * * * *", async () => {
    const startTime = Date.now();
    try {
      // Cleanup expired upload sessions
      logger.info("Starting scheduled cleanup of expired upload sessions");
      const uploadResult = await UploadSession.cleanupExpiredSessions();

      // Cleanup expired download sessions
      logger.info("Starting scheduled cleanup of expired download sessions");
      const downloadResult = await DownloadSession.cleanupExpiredSessions();

      const duration = Date.now() - startTime;
      logger.logCleanup("expired-sessions", {
        uploadSessionsRemoved: uploadResult?.deletedCount || 0,
        downloadSessionsRemoved: downloadResult?.deletedCount || 0,
        duration,
      });
    } catch (error) {
      logger.logError(error, { operation: "scheduled-cleanup" });
    }
  });

  // Run trash cleanup every day at midnight (0 0 * * *)
  cron.schedule("0 0 * * *", async () => {
    logger.info("Starting scheduled trash cleanup");
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. Delete files older than 30 days
      const filesToDelete = await File.find({
        trash: true,
        trashedAt: { $lt: thirtyDaysAgo },
      });

      let filesDeletedCount = 0;
      for (const file of filesToDelete) {
        try {
          // Delete physical file
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          // Delete thumbnail if it exists
          if (file.owner) {
            // Assuming thumbnail path structure based on previous knowledge or standard pattern
            // Thumbnails are usually in uploads/thumbnails/userId/fileId-thumb.jpg
            // Need to constructing path carefully relative to app root if possible, or assume known safe path
            const thumbnailPath = path.join(
              __dirname,
              "..",
              "uploads",
              "thumbnails",
              file.owner.toString(),
              `${file._id}-thumb.jpg`,
            );
            if (fs.existsSync(thumbnailPath)) {
              fs.unlinkSync(thumbnailPath);
            }
          }

          // Update user storage
          if (file.owner) {
            await User.findByIdAndUpdate(file.owner, {
              $inc: { storageUsed: -file.size },
            });
          }

          await File.findByIdAndDelete(file._id);
          filesDeletedCount++;
        } catch (err) {
          logger.error(
            `Failed to auto-delete file ${file._id}: ${err.message}`,
          );
        }
      }

      // 2. Delete folders older than 30 days
      // Only delete if they are empty of "active" (non-trash) files
      // Because we already deleted all old trash files, the folder should be effectively empty
      // or contain only young trash files?
      // Wait, if a folder contains a file that was trashed YESTERDAY, we should NOT delete the folder.
      // So we check if the folder has ANY children (trash or not) that are NOT eligible for deletion yet.
      // Actually simpler: if the folder has any children in DB, don't delete it yet?
      // If we deleted the old trash files, they are gone.
      // If there are files left, they are either:
      // a) Active files (shouldn't happen if folder is trash, but safety first)
      // b) Young trash files (<30 days).
      // If (b) exists, we should NOT delete the folder.

      const foldersToDelete = await Folder.find({
        trash: true,
        trashedAt: { $lt: thirtyDaysAgo },
      });

      let foldersDeletedCount = 0;
      for (const folder of foldersToDelete) {
        // Check for any children (files or folders)
        const fileChildren = await File.countDocuments({ parent: folder._id });
        const folderChildren = await Folder.countDocuments({
          parent: folder._id,
        });

        if (fileChildren === 0 && folderChildren === 0) {
          await Folder.findByIdAndDelete(folder._id);
          foldersDeletedCount++;
        }
      }

      logger.logCleanup("trash-cleanup", {
        filesDeleted: filesDeletedCount,
        foldersDeleted: foldersDeletedCount,
        threshold: thirtyDaysAgo,
      });
    } catch (error) {
      logger.logError(error, { operation: "scheduled-trash-cleanup" });
    }
  });
};

/**
 * Manual cleanup function
 */
const runCleanup = async () => {
  const startTime = Date.now();
  try {
    logger.info("Starting manual cleanup of expired sessions");

    // Cleanup expired upload sessions
    const uploadResult = await UploadSession.cleanupExpiredSessions();

    // Cleanup expired download sessions
    const downloadResult = await DownloadSession.cleanupExpiredSessions();

    const duration = Date.now() - startTime;
    logger.logCleanup("manual-expired-sessions", {
      uploadSessionsRemoved: uploadResult?.deletedCount || 0,
      downloadSessionsRemoved: downloadResult?.deletedCount || 0,
      duration,
    });

    return {
      uploadSessions: uploadResult,
      downloadSessions: downloadResult,
    };
  } catch (error) {
    logger.logError(error, { operation: "manual-cleanup" });
    throw error;
  }
};

module.exports = {
  initializeCleanupScheduler,
  runCleanup,
};
