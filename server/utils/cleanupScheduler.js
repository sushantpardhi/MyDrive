const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");

/**
 * Initialize cleanup scheduler
 */
const initializeCleanupScheduler = () => {
  // Run cleanup every hour (0 * * * *)
  cron.schedule("0 * * * *", async () => {
    try {
      await UploadSession.cleanupExpiredSessions();
    } catch (error) {
      // Cleanup errors are logged in the model method
    }
  });
};

/**
 * Manual cleanup function
 */
const runCleanup = async () => {
  try {
    return await UploadSession.cleanupExpiredSessions();
  } catch (error) {
    console.error("Manual cleanup error:", error);
    throw error;
  }
};

module.exports = {
  initializeCleanupScheduler,
  runCleanup,
};
