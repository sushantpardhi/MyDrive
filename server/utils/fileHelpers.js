const path = require("path");
const fs = require("fs");

/**
 * Generate user-specific directory path
 * @param {string} userId - The user ID
 * @returns {string} The user-specific directory path
 */
const getUserUploadDir = (userId) => {
  return path.join("uploads", userId);
};

/**
 * Ensure user directory exists, create if it doesn't
 * @param {string} userId - The user ID
 * @returns {string} The user-specific directory path
 */
const ensureUserDir = (userId) => {
  const userDir = getUserUploadDir(userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
};

/**
 * Get full file path for a user's file
 * @param {string} userId - The user ID
 * @param {string} filename - The filename
 * @returns {string} The full file path
 */
const getUserFilePath = (userId, filename) => {
  const userDir = getUserUploadDir(userId);
  return path.join(userDir, filename);
};

module.exports = {
  getUserUploadDir,
  ensureUserDir,
  getUserFilePath,
};
