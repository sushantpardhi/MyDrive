const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const logger = require("./logger");

/**
 * Storage abstraction layer for file operations
 * Supports both local filesystem and S3-compatible storage
 * 
 * This design allows easy migration to cloud storage (AWS S3, MinIO, etc.)
 * without changing business logic
 */

class StorageProvider {
  constructor(config = {}) {
    this.type = config.type || "local"; // 'local' or 's3'
    this.s3Client = config.s3Client || null;
    this.bucket = config.bucket || null;
    this.localBasePath = config.localBasePath || "uploads";
  }

  /**
   * Get a readable stream for a file
   * @param {string} filePath - Path to the file (relative to base path)
   * @returns {Promise<Readable>} Readable stream
   */
  async getFileStream(filePath) {
    if (this.type === "s3") {
      return this._getS3Stream(filePath);
    } else {
      return this._getLocalStream(filePath);
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    if (this.type === "s3") {
      return this._s3FileExists(filePath);
    } else {
      return this._localFileExists(filePath);
    }
  }

  /**
   * Get file metadata (size, modified time, etc.)
   * @param {string} filePath - Path to the file
   * @returns {Promise<object>} File metadata
   */
  async getFileMetadata(filePath) {
    if (this.type === "s3") {
      return this._getS3Metadata(filePath);
    } else {
      return this._getLocalMetadata(filePath);
    }
  }

  /**
   * List files in a directory
   * @param {string} dirPath - Path to directory
   * @returns {Promise<Array>} Array of file entries
   */
  async listFiles(dirPath) {
    if (this.type === "s3") {
      return this._listS3Files(dirPath);
    } else {
      return this._listLocalFiles(dirPath);
    }
  }

  // ===== LOCAL FILESYSTEM METHODS =====

  /**
   * Get readable stream for local file
   * @private
   */
  _getLocalStream(filePath) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.localBasePath, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * Check if local file exists
   * @private
   */
  _localFileExists(filePath) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.localBasePath, filePath);

    return fs.existsSync(fullPath);
  }

  /**
   * Get local file metadata
   * @private
   */
  _getLocalMetadata(filePath) {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.localBasePath, filePath);

    const stats = fs.statSync(fullPath);

    return {
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  }

  /**
   * List local files
   * @private
   */
  _listLocalFiles(dirPath) {
    const fullPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(this.localBasePath, dirPath);

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(fullPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  // ===== S3 METHODS (Future implementation) =====

  /**
   * Get readable stream from S3
   * @private
   */
  async _getS3Stream(key) {
    // TODO: Implement S3 streaming
    // Example implementation:
    /*
    if (!this.s3Client) {
      throw new Error("S3 client not configured");
    }

    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    const { Body } = await this.s3Client.getObject(params).promise();
    return Body;
    */

    throw new Error("S3 storage not yet implemented");
  }

  /**
   * Check if S3 object exists
   * @private
   */
  async _s3FileExists(key) {
    // TODO: Implement S3 head object check
    /*
    try {
      await this.s3Client.headObject({
        Bucket: this.bucket,
        Key: key,
      }).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
    */

    throw new Error("S3 storage not yet implemented");
  }

  /**
   * Get S3 object metadata
   * @private
   */
  async _getS3Metadata(key) {
    // TODO: Implement S3 metadata retrieval
    /*
    const metadata = await this.s3Client.headObject({
      Bucket: this.bucket,
      Key: key,
    }).promise();

    return {
      size: metadata.ContentLength,
      modified: metadata.LastModified,
      contentType: metadata.ContentType,
      isDirectory: false,
      isFile: true,
    };
    */

    throw new Error("S3 storage not yet implemented");
  }

  /**
   * List S3 objects
   * @private
   */
  async _listS3Files(prefix) {
    // TODO: Implement S3 object listing
    /*
    const params = {
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: '/',
    };

    const data = await this.s3Client.listObjectsV2(params).promise();

    return [
      ...(data.CommonPrefixes || []).map(p => ({
        name: p.Prefix.split('/').filter(Boolean).pop(),
        path: p.Prefix,
        isDirectory: true,
        isFile: false,
      })),
      ...(data.Contents || []).map(obj => ({
        name: obj.Key.split('/').pop(),
        path: obj.Key,
        isDirectory: false,
        isFile: true,
      })),
    ];
    */

    throw new Error("S3 storage not yet implemented");
  }
}

// Factory function to create storage provider
function createStorageProvider(config = {}) {
  // Check environment variables for storage configuration
  const storageType = process.env.STORAGE_TYPE || config.type || "local";

  if (storageType === "s3") {
    // TODO: Initialize S3 client
    /*
    const AWS = require('aws-sdk');
    const s3Client = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    return new StorageProvider({
      type: 's3',
      s3Client,
      bucket: process.env.S3_BUCKET,
    });
    */

    logger.warn("S3 storage requested but not implemented, falling back to local");
    return new StorageProvider({ type: "local" });
  } else {
    return new StorageProvider({ type: "local" });
  }
}

module.exports = {
  StorageProvider,
  createStorageProvider,
};
