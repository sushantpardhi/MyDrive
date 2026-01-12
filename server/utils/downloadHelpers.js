const File = require("../models/File");
const Folder = require("../models/Folder");
const logger = require("./logger");

/**
 * Download helpers for resolving files and folders recursively
 * Handles permission checks, folder traversal, and file path resolution
 */

class DownloadHelpers {
  /**
   * Validate user access to a file
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} File object if authorized, null otherwise
   */
  static async validateFileAccess(fileId, userId) {
    try {
      const file = await File.findById(fileId);

      if (!file) {
        logger.warn("File not found during download", { fileId, userId });
        return null;
      }

      // Check if file is in trash
      if (file.trash) {
        logger.warn("Attempted to download trashed file", { fileId, userId });
        return null;
      }

      // Check ownership or shared access
      const hasAccess =
        file.owner.toString() === userId ||
        (file.shared && file.shared.some((id) => id.toString() === userId));

      if (!hasAccess) {
        logger.warn("Unauthorized file access attempt", { fileId, userId });
        return null;
      }

      return file;
    } catch (error) {
      logger.error("Error validating file access", {
        fileId,
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Validate user access to a folder
   * @param {string} folderId - Folder ID
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} Folder object if authorized, null otherwise
   */
  static async validateFolderAccess(folderId, userId) {
    try {
      const folder = await Folder.findById(folderId);

      if (!folder) {
        logger.warn("Folder not found during download", { folderId, userId });
        return null;
      }

      // Check if folder is in trash
      if (folder.trash) {
        logger.warn("Attempted to download trashed folder", {
          folderId,
          userId,
        });
        return null;
      }

      // Check ownership or shared access
      const hasAccess =
        folder.owner.toString() === userId ||
        (folder.shared && folder.shared.some((id) => id.toString() === userId));

      if (!hasAccess) {
        logger.warn("Unauthorized folder access attempt", { folderId, userId });
        return null;
      }

      return folder;
    } catch (error) {
      logger.error("Error validating folder access", {
        folderId,
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Recursively get all files in a folder with their paths
   * @param {string} folderId - Folder ID
   * @param {string} userId - User ID
   * @param {string} basePath - Base path for ZIP structure
   * @returns {Promise<Array>} Array of {fileDoc, filePath, zipPath} objects
   */
  static async getFolderFilesRecursive(folderId, userId, basePath = "") {
    const results = [];

    try {
      // Get folder
      const folder = await this.validateFolderAccess(folderId, userId);
      if (!folder) {
        logger.warn("Skipping inaccessible folder", { folderId, userId });
        return results;
      }

      // Get all files in this folder
      const files = await File.find({
        parent: folderId,
        trash: false,
      });

      // Add files to results
      for (const file of files) {
        // Verify access to individual file
        const hasAccess = await this.validateFileAccess(file._id.toString(), userId);
        if (hasAccess) {
          results.push({
            fileDoc: file,
            filePath: file.path, // Absolute path on disk
            zipPath: basePath ? `${basePath}/${file.name}` : file.name,
            size: file.size || 0,
          });
        }
      }

      // Get all subfolders
      const subfolders = await Folder.find({
        parent: folderId,
        trash: false,
      });

      // Recursively process subfolders
      for (const subfolder of subfolders) {
        const subfolderPath = basePath
          ? `${basePath}/${subfolder.name}`
          : subfolder.name;

        const subfolderFiles = await this.getFolderFilesRecursive(
          subfolder._id.toString(),
          userId,
          subfolderPath
        );

        results.push(...subfolderFiles);
      }
    } catch (error) {
      logger.error("Error getting folder files recursively", {
        folderId,
        userId,
        basePath,
        error: error.message,
      });
    }

    return results;
  }

  /**
   * Resolve all files from mixed selection (files + folders)
   * @param {Array<string>} fileIds - Array of file IDs
   * @param {Array<string>} folderIds - Array of folder IDs
   * @param {string} userId - User ID
   * @returns {Promise<object>} Object with files array and metadata
   */
  static async resolveDownloadSelection(fileIds = [], folderIds = [], userId) {
    const allFiles = [];
    const errors = [];
    const folderNames = [];

    try {
      // Process individual files
      for (const fileId of fileIds) {
        const file = await this.validateFileAccess(fileId, userId);

        if (file) {
          allFiles.push({
            fileDoc: file,
            filePath: file.path,
            zipPath: file.name, // Root level in ZIP
            size: file.size || 0,
          });
        } else {
          errors.push({
            id: fileId,
            type: "file",
            error: "File not found or access denied",
          });
        }
      }

      // Process folders recursively
      for (const folderId of folderIds) {
        const folder = await this.validateFolderAccess(folderId, userId);

        if (folder) {
          folderNames.push(folder.name);

          // Get all files in folder recursively
          const folderFiles = await this.getFolderFilesRecursive(
            folderId,
            userId,
            folder.name // Use folder name as base path
          );

          allFiles.push(...folderFiles);
        } else {
          errors.push({
            id: folderId,
            type: "folder",
            error: "Folder not found or access denied",
          });
        }
      }

      // Calculate total size
      const totalSize = allFiles.reduce((sum, file) => sum + (file.size || 0), 0);

      // Remove duplicates (in case of shared items)
      const uniqueFiles = this.deduplicateFiles(allFiles);

      logger.info("Download selection resolved", {
        userId,
        requestedFiles: fileIds.length,
        requestedFolders: folderIds.length,
        resolvedFiles: uniqueFiles.length,
        totalSize,
        errors: errors.length,
      });

      return {
        files: uniqueFiles,
        totalSize,
        totalFiles: uniqueFiles.length,
        errors,
        folderNames,
      };
    } catch (error) {
      logger.error("Error resolving download selection", {
        userId,
        fileIds,
        folderIds,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Remove duplicate files from array
   * @param {Array} files - Array of file objects
   * @returns {Array} Deduplicated array
   */
  static deduplicateFiles(files) {
    const seen = new Set();
    const unique = [];

    for (const file of files) {
      const fileId = file.fileDoc._id.toString();

      if (!seen.has(fileId)) {
        seen.add(fileId);
        unique.push(file);
      }
    }

    return unique;
  }

  /**
   * Generate appropriate ZIP filename based on selection
   * @param {Array<string>} fileIds - File IDs
   * @param {Array<string>} folderIds - Folder IDs
   * @param {Array<string>} folderNames - Folder names
   * @returns {string} ZIP filename
   */
  static generateZipFilename(fileIds, folderIds, folderNames = []) {
    const timestamp = new Date().toISOString().split("T")[0];

    // Single folder selected
    if (folderIds.length === 1 && fileIds.length === 0) {
      const folderName = folderNames[0] || "folder";
      return `${folderName}.zip`;
    }

    // Single file selected
    if (fileIds.length === 1 && folderIds.length === 0) {
      return `file-${timestamp}.zip`;
    }

    // Multiple items
    const totalItems = fileIds.length + folderIds.length;
    return `MyDrive-${totalItems}-items-${timestamp}.zip`;
  }

  /**
   * Check if total size exceeds limit
   * @param {number} totalSize - Total size in bytes
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {boolean} True if size is acceptable
   */
  static checkSizeLimit(totalSize, maxSize) {
    if (maxSize <= 0) return true; // No limit
    return totalSize <= maxSize;
  }

  /**
   * Format size for logging
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  static formatSize(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

module.exports = DownloadHelpers;
