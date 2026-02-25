const redis = require("redis");
const logger = require("./logger");

class RedisCache {
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
    const redisDB = process.env.REDIS_CACHE_DB || 1; // Use DB 1 for cache by default

    try {
      this.client = redis.createClient({
        socket: {
          host: redisHost,
          port: redisPort,
        },
        database: redisDB,
      });

      this.client.on("error", (err) => {
        logger.error("Redis Cache Client Error", { error: err.message });
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info(
          `Connected to Redis Cache - ${redisHost}:${redisPort} (DB: ${redisDB})`,
        );
        this.isConnected = true;
      });

      this.client.on("disconnect", () => {
        logger.warn("Disconnected from Redis Cache");
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error("Failed to connect to Redis Cache", {
        error: error.message,
      });
      this.isConnected = false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis Cache connection closed");
    }
  }

  /**
   * Get a cached value
   * @param {string} key - Cache key
   * @returns {Object|null} - Parsed JSON object or null
   */
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null; // Fail gracefully if Redis is down
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error(`Redis Cache Get Error (${key})`, { error: error.message });
      return null;
    }
  }

  /**
   * Set a cache value with an expiration
   * @param {string} key - Cache key
   * @param {Object} value - Data to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = 300) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Redis Cache Set Error (${key})`, { error: error.message });
      return false;
    }
  }

  /**
   * Invalidate all cached data for a specific user
   * Designed to safely delete keys matching `cache:${userId}:*`
   * @param {string} userId - ID of the user whose cache should be cleared
   */
  async invalidateUserCache(userId) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const matchPattern = `cache:${userId}:*`;
      let cursor = "0"; // v4 expects string cursor
      let deletedCount = 0;

      do {
        // Use SCAN to safely find keys matching the pattern without blocking Redis
        const result = await this.client.scan(cursor, {
          MATCH: matchPattern,
          COUNT: 100,
        });

        cursor = result.cursor.toString();
        const keys = result.keys;

        if (keys.length > 0) {
          await this.client.unlink(keys); // Unlink is non-blocking (faster than DEL)
          deletedCount += keys.length;
        }
      } while (cursor !== "0");

      logger.info("User cache invalidated", {
        userId,
        deletedKeys: deletedCount,
      });
      return true;
    } catch (error) {
      logger.error("Redis Cache Invalidation Error", {
        userId,
        error: error.message,
      });
      return false;
    }
  }
}

const redisCache = new RedisCache();

module.exports = redisCache;
