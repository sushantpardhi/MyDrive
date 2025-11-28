const cron = require("node-cron");
const UploadSession = require("../models/UploadSession");

/**
 * Initialize cleanup scheduler
 */
const initializeCleanupScheduler = () => {
  // Run cleanup every hour (0 * * * *)
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("Running upload session cleanup...");
      await UploadSession.cleanupExpiredSessions();
    } catch (error) {
      console.error("Cleanup scheduler error:", error);
    }
  });

  console.log("Upload session cleanup scheduler initialized");
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
