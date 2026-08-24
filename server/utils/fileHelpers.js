const path = require("path");
const fs = require("fs");

/**
 * Get the base storage directory
 * @returns {string} The base absolute path for storage
 */
const getBaseDir = () => {
  if (process.env.UPLOAD_DIR) {
    if (path.isAbsolute(process.env.UPLOAD_DIR)) {
      return process.env.UPLOAD_DIR;
    }
    return path.join(process.cwd(), process.env.UPLOAD_DIR);
  }
  return path.join(process.cwd(), "uploads");
};

/**
 * Generate user-specific directory path
 * @param {string} userId - The user ID
 * @returns {string} The user-specific directory path
 */
const getUserUploadDir = (userId) => {
  return path.join(getBaseDir(), userId);
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

/**
 * Map of common file signatures (magic bytes) for validation
 * Format: [magic_bytes_hex]: { mimeType: string, extensions: string[] }
 */
const FILE_SIGNATURES = {
  // Images
  "FFD8FF": { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  "89504E47": { mimeType: "image/png", extensions: [".png"] },
  "47494638": { mimeType: "image/gif", extensions: [".gif"] },
  "424D": { mimeType: "image/bmp", extensions: [".bmp"] },
  "52494646": { mimeType: "image/webp", extensions: [".webp"] }, // RIFF (WebP starts with RIFF)
  "49492A00": { mimeType: "image/tiff", extensions: [".tiff", ".tif"] },
  "4D4D002A": { mimeType: "image/tiff", extensions: [".tiff", ".tif"] },
  
  // Documents
  "25504446": { mimeType: "application/pdf", extensions: [".pdf"] },
  "D0CF11E0": { mimeType: "application/vnd.ms-office", extensions: [".doc", ".xls", ".ppt"] },
  "504B0304": { mimeType: "application/zip", extensions: [".zip", ".docx", ".xlsx", ".pptx"] },
  
  // Video
  "6674797069736F6D": { mimeType: "video/mp4", extensions: [".mp4", ".m4v"] }, // ftypisom
  "000000186674797069736F6D": { mimeType: "video/mp4", extensions: [".mp4"] },
  
  // Audio
  "FFE3": { mimeType: "audio/mpeg", extensions: [".mp3"] }, // MP3 v2
  "FFFB": { mimeType: "audio/mpeg", extensions: [".mp3"] }, // MP3 v1
  "FFFA": { mimeType: "audio/mpeg", extensions: [".mp3"] }, // MP3 v2.5
  "49443": { mimeType: "audio/mpeg", extensions: [".mp3"] }, // ID3
  "524946464157415645": { mimeType: "audio/wav", extensions: [".wav"] }, // RIFF....WAVE
  
  // Executable (should block)
  "4D5A": { mimeType: "application/x-executable", extensions: [".exe", ".com", ".bat", ".cmd"] },
  "7F454C46": { mimeType: "application/x-executable", extensions: [".elf", ".out"] },
};

/**
 * Validate file type by magic bytes
 * @param {string} filePath - Path to the file to validate
 * @param {string} declaredMimeType - MIME type declared by client
 * @returns {Promise<{valid: boolean, detectedType: string, reason?: string}>}
 */
const validateFileMagicBytes = async (filePath, declaredMimeType) => {
  return new Promise((resolve, reject) => {
    try {
      const buffer = Buffer.alloc(12); // Most signatures fit in 12 bytes
      const fd = fs.openSync(filePath, "r");
      
      try {
        fs.readSync(fd, buffer, 0, 12);
      } finally {
        fs.closeSync(fd);
      }

      const hex = buffer.toString("hex").toUpperCase();

      // Check against known signatures
      for (const [signature, metadata] of Object.entries(FILE_SIGNATURES)) {
        if (hex.startsWith(signature)) {
          // Check for dangerous file types
          if (metadata.mimeType.includes("executable")) {
            return resolve({
              valid: false,
              detectedType: metadata.mimeType,
              reason: "Executable files are not allowed",
            });
          }

          // Check if detected type matches declared type
          // Allow some flexibility for similar types (e.g., image/* variants)
          const typeMatches =
            metadata.mimeType === declaredMimeType ||
            (metadata.extensions && 
             metadata.extensions.some((ext) =>
               declaredMimeType?.toLowerCase().includes(
                 ext.replace(".", "")
               )
            ));

          if (!typeMatches) {
            return resolve({
              valid: false,
              detectedType: metadata.mimeType,
              reason: `File signature mismatch. Detected: ${metadata.mimeType}, Declared: ${declaredMimeType}`,
            });
          }

          return resolve({
            valid: true,
            detectedType: metadata.mimeType,
          });
        }
      }

      // Unknown signature - allow by default (could be newer format)
      resolve({
        valid: true,
        detectedType: "application/octet-stream",
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get safe file extension based on detected MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} Safe file extension
 */
const getSafeExtension = (mimeType) => {
  if (!mimeType) return ".bin";
  
  for (const [, metadata] of Object.entries(FILE_SIGNATURES)) {
    if (metadata.mimeType === mimeType && metadata.extensions.length > 0) {
      return metadata.extensions[0];
    }
  }
  return ".bin";
};

module.exports = {
  getBaseDir,
  getUserUploadDir,
  ensureUserDir,
  getUserFilePath,
  validateFileMagicBytes,
  getSafeExtension,
  FILE_SIGNATURES,
};
