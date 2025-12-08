const logger = require("./logger");
const emailService = require("./emailService");

/**
 * Storage Helper Utilities
 * Handles storage limit checking and notification logic
 */

// Storage notification thresholds (in percentage)
const NOTIFICATION_THRESHOLDS = {
  WARNING_50: 50,
  WARNING_75: 75,
  WARNING_90: 90,
  LIMIT_100: 100,
};

/**
 * Check if user has enough storage for a file upload
 * @param {Object} user - User document with storageUsed and storageLimit
 * @param {Number} fileSize - Size of file to be uploaded in bytes
 * @returns {Object} - { hasSpace: boolean, currentUsage: number, limit: number, percentage: number }
 */
function checkStorageAvailability(user, fileSize) {
  const currentUsage = user.storageUsed || 0;
  const limit = user.storageLimit || 5 * 1024 * 1024 * 1024; // Default 5GB

  // Check for unlimited storage (admin/family roles)
  const isUnlimited = limit === -1;

  if (isUnlimited) {
    logger.debug("Storage check - Unlimited storage", {
      userId: user._id,
      role: user.role,
      currentUsage,
      fileSize,
    });

    return {
      hasSpace: true,
      currentUsage,
      newUsage: currentUsage + fileSize,
      limit: -1,
      percentage: 0, // 0% for unlimited
      remainingSpace: -1, // -1 represents unlimited
      isUnlimited: true,
    };
  }

  // Regular storage limit check for guest users
  const newUsage = currentUsage + fileSize;
  const hasSpace = newUsage <= limit;
  const percentage = (currentUsage / limit) * 100;

  logger.debug("Storage check", {
    userId: user._id,
    role: user.role,
    currentUsage,
    fileSize,
    newUsage,
    limit,
    hasSpace,
    percentage: percentage.toFixed(2),
  });

  return {
    hasSpace,
    currentUsage,
    newUsage,
    limit,
    percentage,
    remainingSpace: limit - currentUsage,
    isUnlimited: false,
  };
}

/**
 * Determine which notification threshold has been crossed
 * @param {Number} percentage - Current storage usage percentage
 * @returns {Number|null} - Threshold level or null if no threshold crossed
 */
function getNotificationThreshold(percentage) {
  if (percentage >= NOTIFICATION_THRESHOLDS.LIMIT_100) {
    return NOTIFICATION_THRESHOLDS.LIMIT_100;
  } else if (percentage >= NOTIFICATION_THRESHOLDS.WARNING_90) {
    return NOTIFICATION_THRESHOLDS.WARNING_90;
  } else if (percentage >= NOTIFICATION_THRESHOLDS.WARNING_75) {
    return NOTIFICATION_THRESHOLDS.WARNING_75;
  } else if (percentage >= NOTIFICATION_THRESHOLDS.WARNING_50) {
    return NOTIFICATION_THRESHOLDS.WARNING_50;
  }
  return null;
}

/**
 * Check if user should receive storage notification
 * Prevents duplicate notifications at same threshold
 * @param {Object} user - User document
 * @param {Number} newThreshold - New threshold level
 * @returns {Boolean} - True if notification should be sent
 */
function shouldNotifyUser(user, newThreshold) {
  const lastNotification = user.lastStorageNotificationLevel || 0;
  return newThreshold > lastNotification;
}

/**
 * Format bytes to human-readable format
 * @param {Number} bytes - Bytes to format
 * @param {Number} decimals - Number of decimal places
 * @returns {String} - Formatted string (e.g., "1.23 GB")
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Send storage notification email based on threshold
 * @param {Object} user - User document
 * @param {Number} threshold - Threshold percentage
 * @param {Object} storageInfo - Storage information object
 */
async function sendStorageNotification(user, threshold, storageInfo) {
  try {
    if (threshold === NOTIFICATION_THRESHOLDS.LIMIT_100) {
      await emailService.sendStorageLimitReachedEmail(user, storageInfo);
    } else {
      await emailService.sendStorageWarningEmail(user, threshold, storageInfo);
    }

    logger.info("Storage notification sent", {
      userId: user._id,
      email: user.email,
      threshold,
      percentage: storageInfo.percentage.toFixed(2),
    });
  } catch (error) {
    logger.error("Failed to send storage notification", {
      userId: user._id,
      error: error.message,
    });
  }
}

/**
 * Handle storage check and notifications after upload
 * @param {Object} user - User document
 * @param {Number} fileSize - Size of uploaded file
 */
async function handlePostUploadNotification(user, fileSize) {
  const User = require("../models/User");

  try {
    // Get fresh user data
    const updatedUser = await User.findById(user._id || user.id);
    if (!updatedUser) {
      logger.warn("User not found for post-upload notification", {
        userId: user._id || user.id,
      });
      return;
    }

    // Skip notifications for unlimited storage users
    if (updatedUser.storageLimit === -1) {
      logger.debug("Skipping storage notification - Unlimited storage", {
        userId: updatedUser._id,
        role: updatedUser.role,
      });
      return;
    }

    // Calculate current storage percentage
    const storageInfo = {
      currentUsage: updatedUser.storageUsed,
      limit: updatedUser.storageLimit,
      percentage: (updatedUser.storageUsed / updatedUser.storageLimit) * 100,
      remainingSpace: updatedUser.storageLimit - updatedUser.storageUsed,
      formattedUsed: formatBytes(updatedUser.storageUsed),
      formattedLimit: formatBytes(updatedUser.storageLimit),
      formattedRemaining: formatBytes(
        updatedUser.storageLimit - updatedUser.storageUsed
      ),
    };

    // Check which threshold has been crossed
    const currentThreshold = getNotificationThreshold(storageInfo.percentage);

    if (currentThreshold && shouldNotifyUser(updatedUser, currentThreshold)) {
      // Send notification
      await sendStorageNotification(updatedUser, currentThreshold, storageInfo);

      // Update last notification level
      updatedUser.lastStorageNotificationLevel = currentThreshold;
      await updatedUser.save();

      logger.info("Updated user storage notification level", {
        userId: updatedUser._id,
        level: currentThreshold,
      });
    }
  } catch (error) {
    logger.error("Error handling post-upload notification", {
      userId: user._id || user.id,
      error: error.message,
    });
  }
}

/**
 * Validate storage before upload
 * Returns error object if storage limit exceeded
 * @param {Object} user - User document
 * @param {Number} fileSize - Size of file to upload
 * @returns {Object|null} - Error object or null if valid
 */
function validateStorageForUpload(user, fileSize) {
  const storageCheck = checkStorageAvailability(user, fileSize);

  // Unlimited storage users always have space
  if (storageCheck.isUnlimited) {
    logger.debug("Upload validation passed - Unlimited storage", {
      userId: user._id,
      role: user.role,
      fileSize,
    });
    return null;
  }

  if (!storageCheck.hasSpace) {
    logger.warn("Upload rejected - Storage limit exceeded", {
      userId: user._id,
      role: user.role,
      fileSize,
      currentUsage: storageCheck.currentUsage,
      limit: storageCheck.limit,
      percentage: storageCheck.percentage.toFixed(2),
    });

    return {
      error: "Storage limit exceeded",
      message: `You have exceeded your storage limit. Current usage: ${formatBytes(
        storageCheck.currentUsage
      )} of ${formatBytes(
        storageCheck.limit
      )} (${storageCheck.percentage.toFixed(
        1
      )}%). Please delete some files to free up space.`,
      code: "STORAGE_LIMIT_EXCEEDED",
      details: {
        currentUsage: storageCheck.currentUsage,
        limit: storageCheck.limit,
        percentage: storageCheck.percentage,
        formattedUsed: formatBytes(storageCheck.currentUsage),
        formattedLimit: formatBytes(storageCheck.limit),
        remainingSpace: storageCheck.remainingSpace,
        formattedRemaining: formatBytes(storageCheck.remainingSpace),
      },
    };
  }

  return null;
}

module.exports = {
  checkStorageAvailability,
  getNotificationThreshold,
  shouldNotifyUser,
  formatBytes,
  sendStorageNotification,
  handlePostUploadNotification,
  validateStorageForUpload,
  NOTIFICATION_THRESHOLDS,
};
