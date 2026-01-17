const redis = require("redis");
const logger = require("./logger");
const path = require("path");

class RedisQueue {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return;
    }

    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisDB = process.env.REDIS_DB || 0;

    try {
      this.client = redis.createClient({
        socket: {
          host: redisHost,
          port: redisPort,
        },
        database: redisDB,
      });

      this.client.on("error", (err) => {
        logger.error("Redis Client Error", { error: err.message });
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info(`Connected to Redis - ${redisHost}:${redisPort} (DB: ${redisDB})`);
        this.isConnected = true;
      });

      this.client.on("disconnect", () => {
        logger.warn("Disconnected from Redis");
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error("Failed to connect to Redis", { error: error.message });
      this.isConnected = false;
      // Don't throw error - allow server to continue without Redis
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis connection closed");
    }
  }

  /**
   * Check if a file is an image based on its mimetype
   */
  isImageFile(mimetype) {
    const imageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
      "image/svg+xml",
    ];
    return imageTypes.includes(mimetype.toLowerCase());
  }

  /**
   * Send an image processing job to the Redis queue
   * @param {Object} jobData - The job data
   * @param {string} jobData.filePath - Absolute path to the uploaded file
   * @param {string} jobData.fileName - Original filename
   * @param {string} jobData.userId - User ID
   * @param {string} jobData.mimetype - File mimetype
   * @param {Array<string>} jobData.operations - Operations to perform (default: ["thumbnail", "blur", "low-quality"])
   */
  async sendImageJob(jobData) {
    if (!this.isConnected || !this.client) {
      logger.warn("Redis not connected - skipping image processing job", {
        fileName: jobData.fileName,
      });
      return false;
    }

    // Only process image files
    if (!this.isImageFile(jobData.mimetype)) {
      logger.debug("Skipping non-image file", {
        fileName: jobData.fileName,
        mimetype: jobData.mimetype,
      });
      return false;
    }

    try {
      // Extract the unique filename from the path
      const uniqueFileName = path.basename(jobData.filePath);
      const jobId = path.parse(uniqueFileName).name; // Remove extension

      // Create output directory path: server/uploads/<userId>/processed
      const outputDir = path.join(
        process.cwd(),
        "uploads",
        jobData.userId,
        "processed"
      );

      const job = {
        jobId: jobId,
        inputPath: path.resolve(jobData.filePath),
        outputDir: path.resolve(outputDir),
        operations: jobData.operations || ["thumbnail", "blur", "low-quality"],
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Push job to Redis queue using RPUSH (FIFO)
      await this.client.rPush("image:jobs", JSON.stringify(job));

      logger.info("Image processing job sent to queue", {
        jobId: job.jobId,
        fileName: jobData.fileName,
        userId: jobData.userId,
        operations: job.operations,
      });

      return true;
    } catch (error) {
      logger.error("Failed to send image job to queue", {
        error: error.message,
        fileName: jobData.fileName,
      });
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const [jobs, retry, failed, done] = await Promise.all([
        this.client.lLen("image:jobs"),
        this.client.lLen("image:retry"),
        this.client.lLen("image:failed"),
        this.client.lLen("image:done"),
      ]);

      return {
        jobs,
        retry,
        failed,
        done,
        total: jobs + retry + failed + done,
      };
    } catch (error) {
      logger.error("Failed to get queue stats", { error: error.message });
      return null;
    }
  }
}

// Create singleton instance
const redisQueue = new RedisQueue();

module.exports = redisQueue;
