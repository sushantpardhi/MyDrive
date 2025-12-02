const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");
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
      logger.info("Starting scheduled cleanup of expired upload sessions");
      const result = await UploadSession.cleanupExpiredSessions();
      const duration = Date.now() - startTime;
      logger.logCleanup("expired-upload-sessions", {
        itemsRemoved: result?.deletedCount || 0,
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
    logger.info("Starting manual cleanup of expired upload sessions");
    const result = await UploadSession.cleanupExpiredSessions();
    const duration = Date.now() - startTime;
    logger.logCleanup("manual-expired-sessions", {
      itemsRemoved: result?.deletedCount || 0,
      duration,
    });
    return result;
  } catch (error) {
    logger.logError(error, { operation: "manual-cleanup" });
    throw error;
  }
};

module.exports = {
  initializeCleanupScheduler,
  runCleanup,
};
