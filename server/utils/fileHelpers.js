const path = require("path");
const fs = require("fs");

// Centralized upload directory - reads from UPLOAD_DIR env var
// Resolves relative paths from the server directory (__dirname/..)
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const UPLOAD_BASE_PATH = path.isAbsolute(UPLOAD_DIR)
  ? UPLOAD_DIR
  : path.resolve(path.join(__dirname, "..", UPLOAD_DIR));

/**
 * Get the resolved base upload path
 * @returns {string} The absolute base upload directory path
 */
const getUploadBasePath = () => UPLOAD_BASE_PATH;

/**
 * Generate user-specific directory path
 * @param {string} userId - The user ID
 * @returns {string} The user-specific directory path
 */
const getUserUploadDir = (userId) => {
  return path.join(UPLOAD_BASE_PATH, userId);
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
  UPLOAD_BASE_PATH,
  getUploadBasePath,
  getUserUploadDir,
  ensureUserDir,
  getUserFilePath,
};
