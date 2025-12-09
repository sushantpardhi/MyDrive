const winston = require("winston");
const path = require("path");
require("winston-daily-rotate-file");

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Tell winston about our colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "info";
};

// Create logs directory path
const logsDir = path.join(__dirname, "../logs");

// Define transports
const transports = [
  // Console transport - always enabled
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // Error log file - daily rotation
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxSize: "20m",
    maxFiles: "14d",
    format: format,
  }),

  // Combined log file - daily rotation
  new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    format: format,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan integration
logger.stream = {
  write: (message) => {
    // Remove trailing newline
    logger.http(message.trim());
  },
};

// Helper methods for common logging patterns
logger.logRequest = (req, message) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("user-agent") || "unknown";
  const requestId = req.id || req.requestId;
  logger.http(
    `${message} - ${req.method} ${req.originalUrl} - User: ${
      req.user?.id || "anonymous"
    } - IP: ${ip} - UA: ${userAgent}${
      requestId ? ` - RequestID: ${requestId}` : ""
    }`
  );
};

logger.logError = (error, context = {}) => {
  const { operation, userId, ip, additionalInfo } = context;
  let errorMessage = "";

  if (operation) errorMessage += `[${operation}] `;
  errorMessage += error.message || "Unknown error";
  if (userId) errorMessage += ` - User: ${userId}`;
  if (ip) errorMessage += ` - IP: ${ip}`;
  if (additionalInfo) errorMessage += ` - ${additionalInfo}`;

  if (error.stack) {
    logger.error(`${errorMessage}\nStack: ${error.stack}`);
  } else {
    logger.error(errorMessage);
  }
};

logger.logFileOperation = (operation, file, userId, details = {}) => {
  const { fileSize, mimeType, duration, ip } = details;
  let message = `File ${operation}: "${
    file.filename || file
  }" - User: ${userId}`;

  if (file.fileId || file._id) message += ` - ID: ${file.fileId || file._id}`;
  if (fileSize) message += ` - Size: ${formatBytes(fileSize)}`;
  if (mimeType) message += ` - Type: ${mimeType}`;
  if (duration) message += ` - Duration: ${duration}ms`;
  if (ip) message += ` - IP: ${ip}`;

  logger.info(message);
};

logger.logAuth = (action, userId, details = {}) => {
  const { ip, userAgent, email, success = true } = details;
  let message = `Auth ${success ? "✓" : "✗"}: ${action}`;

  if (email) message += ` - Email: ${email}`;
  if (userId) message += ` - User: ${userId}`;
  if (ip) message += ` - IP: ${ip}`;
  if (userAgent) message += ` - UA: ${userAgent}`;

  logger.info(message);
};

logger.logUpload = (status, filename, userId, details = {}) => {
  const { fileSize, uploadId, chunks, retries, duration, ip } = details;
  let message = `Upload ${status}: "${filename}" - User: ${userId}`;

  if (uploadId) message += ` - UploadID: ${uploadId}`;
  if (fileSize) message += ` - Size: ${formatBytes(fileSize)}`;
  if (chunks) message += ` - Chunks: ${chunks}`;
  if (retries) message += ` - Retries: ${retries}`;
  if (duration) message += ` - Duration: ${duration}ms`;
  if (ip) message += ` - IP: ${ip}`;

  logger.info(message);
};

logger.logChunk = (uploadId, chunkIndex, totalChunks, userId, details = {}) => {
  const { chunkSize, hash, retryCount } = details;
  let message = `Chunk ${
    chunkIndex + 1
  }/${totalChunks} - UploadID: ${uploadId} - User: ${userId}`;

  if (chunkSize) message += ` - Size: ${formatBytes(chunkSize)}`;
  if (hash) message += ` - Hash: ${hash.substring(0, 8)}...`;
  if (retryCount) message += ` - Retry: ${retryCount}`;

  logger.debug(message);
};

logger.logFolderOperation = (operation, folder, userId, details = {}) => {
  const { parent, itemCount, ip } = details;
  let message = `Folder ${operation}: "${
    folder.name || folder
  }" - User: ${userId}`;

  if (folder.folderId || folder._id)
    message += ` - ID: ${folder.folderId || folder._id}`;
  if (parent) message += ` - Parent: ${parent}`;
  if (itemCount !== undefined) message += ` - Items: ${itemCount}`;
  if (ip) message += ` - IP: ${ip}`;

  logger.info(message);
};

logger.logShare = (action, resource, userId, details = {}) => {
  const { sharedWith, resourceType, permissions, ip } = details;
  let message = `Share ${action}: ${resourceType || "resource"} "${
    resource.name || resource
  }" - Owner: ${userId}`;

  if (resource.fileId || resource._id)
    message += ` - ID: ${resource.fileId || resource._id}`;
  if (sharedWith)
    message += ` - SharedWith: ${
      Array.isArray(sharedWith) ? sharedWith.join(", ") : sharedWith
    }`;
  if (permissions) message += ` - Permissions: ${permissions}`;
  if (ip) message += ` - IP: ${ip}`;

  logger.info(message);
};

logger.logEmail = (status, recipient, subject, details = {}) => {
  const { error, duration } = details;
  let message = `Email ${status}: To="${recipient}" - Subject="${subject}"`;

  if (duration) message += ` - Duration: ${duration}ms`;
  if (error) message += ` - Error: ${error}`;

  if (status === "sent") {
    logger.info(message);
  } else {
    logger.warn(message);
  }
};

logger.logDatabase = (operation, collection, details = {}) => {
  const { query, result, duration, error } = details;
  let message = `DB ${operation}: ${collection}`;

  if (query) message += ` - Query: ${JSON.stringify(query)}`;
  if (result) message += ` - Result: ${result}`;
  if (duration) message += ` - Duration: ${duration}ms`;
  if (error) message += ` - Error: ${error}`;

  logger.debug(message);
};

logger.logCleanup = (operation, details = {}) => {
  const { itemsRemoved, spaceFreed, duration } = details;
  let message = `Cleanup: ${operation}`;

  if (itemsRemoved) message += ` - Removed: ${itemsRemoved} items`;
  if (spaceFreed) message += ` - Freed: ${formatBytes(spaceFreed)}`;
  if (duration) message += ` - Duration: ${duration}ms`;

  logger.info(message);
};

logger.logPerformance = (operation, duration, details = {}) => {
  const { threshold = 1000 } = details;
  let message = `Performance: ${operation} - Duration: ${duration}ms`;

  if (details.additionalInfo) message += ` - ${details.additionalInfo}`;

  if (duration > threshold) {
    logger.warn(`⚠️  SLOW ${message}`);
  } else {
    logger.debug(message);
  }
};

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = logger;
