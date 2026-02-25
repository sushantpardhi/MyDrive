const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");
const DownloadSession = require("../models/DownloadSession");
const GuestSession = require("../models/GuestSession");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Cleanup a single guest session and its data
 * @param {Object} session - The session document
 * @returns {Promise<Object>} Stats of deleted items
 */
const cleanupSingleGuestSession = async (session) => {
  let filesDeleted = 0;
  let foldersDeleted = 0;

  const user = session.userId; // Assuming populated

  if (!user) {
    // User already deleted, just clean up session
    await GuestSession.findByIdAndDelete(session._id);
    return {
      filesDeleted: 0,
      foldersDeleted: 0,
      sessionsDeleted: 1,
      usersDeleted: 0,
    };
  }

  try {
    // Delete all files owned by this guest
    const guestFiles = await File.find({ owner: user._id });
    for (const file of guestFiles) {
      try {
        // Delete physical file
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        // Delete thumbnail if exists
        const thumbnailPath = path.join(
          __dirname,
          "..",
          "uploads",
          "thumbnails",
          user._id.toString(),
          `${file._id}-thumb.jpg`,
        );
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }

        await File.findByIdAndDelete(file._id);
        filesDeleted++;
      } catch (err) {
        logger.error(`Failed to delete guest file ${file._id}: ${err.message}`);
      }
    }

    // Delete all folders owned by this guest
    const guestFolders = await Folder.find({ owner: user._id });
    for (const folder of guestFolders) {
      await Folder.findByIdAndDelete(folder._id);
      foldersDeleted++;
    }

    // Delete the user's upload directory if exists
    const userUploadDir = path.join(
      __dirname,
      "..",
      "uploads",
      user._id.toString(),
    );
    if (fs.existsSync(userUploadDir)) {
      fs.rmSync(userUploadDir, { recursive: true, force: true });
    }

    // Delete the user's thumbnail directory if exists
    const userThumbDir = path.join(
      __dirname,
      "..",
      "uploads",
      "thumbnails",
      user._id.toString(),
    );
    if (fs.existsSync(userThumbDir)) {
      fs.rmSync(userThumbDir, { recursive: true, force: true });
    }

    // Delete the temporary guest user
    await User.findByIdAndDelete(user._id);

    // Delete the session
    await GuestSession.findByIdAndDelete(session._id);

    logger.info("Cleaned up guest session", {
      sessionId: session._id,
      userId: user._id,
    });

    return {
      filesDeleted,
      foldersDeleted,
      sessionsDeleted: 1,
      usersDeleted: 1,
    };
  } catch (err) {
    logger.error(
      `Failed to cleanup guest session ${session._id}: ${err.message}`,
    );
    throw err;
  }
};

/**
 * Cleanup expired guest sessions and their data
 */
const cleanupExpiredGuestSessions = async () => {
  const startTime = Date.now();
  let usersDeleted = 0;
  let sessionsDeleted = 0;
  let filesDeleted = 0;
  let foldersDeleted = 0;

  try {
    // Mark expired sessions
    await GuestSession.markExpiredSessions();

    // Find all expired guest sessions
    const expiredSessions = await GuestSession.find({
      status: "expired",
    }).populate("userId");

    for (const session of expiredSessions) {
      try {
        const stats = await cleanupSingleGuestSession(session);
        filesDeleted += stats.filesDeleted;
        foldersDeleted += stats.foldersDeleted;
        sessionsDeleted += stats.sessionsDeleted;
        usersDeleted += stats.usersDeleted;
      } catch (e) {
        // Continue with next session even if one fails
      }
    }

    const duration = Date.now() - startTime;

    if (sessionsDeleted > 0 || usersDeleted > 0) {
      logger.logCleanup("guest-session-cleanup", {
        sessionsDeleted,
        usersDeleted,
        filesDeleted,
        foldersDeleted,
        duration,
      });
    }

    return {
      sessionsDeleted,
      usersDeleted,
      filesDeleted,
      foldersDeleted,
    };
  } catch (error) {
    logger.logError(error, { operation: "guest-session-cleanup" });
    throw error;
  }
};

/**
 * Initialize cleanup scheduler
 */
const initializeCleanupScheduler = () => {
  logger.info("🗑️  Cleanup scheduler initialized - Running every hour");

  // Run guest session cleanup every 5 minutes (*/5 * * * *)
  cron.schedule("*/5 * * * *", async () => {
    try {
      await cleanupExpiredGuestSessions();
    } catch (error) {
      logger.logError(error, { operation: "scheduled-guest-cleanup" });
    }
  });

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
  cleanupSingleGuestSession,
};
