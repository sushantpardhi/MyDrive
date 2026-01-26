const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");
const DownloadSession = require("../models/DownloadSession");
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
