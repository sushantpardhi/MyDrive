const redisCache = require("../utils/redisCache");
const logger = require("../utils/logger");

/**
 * Middleware to cache Express route responses in Redis.
 * Only caches GET requests.
 * @param {Object} options Options object
 * @param {number} options.ttl TTL in seconds (default: 300 / 5 minutes)
 */
const cacheMiddleware = (options = { ttl: 300 }) => {
  return async (req, res, next) => {
    // Only conditionally cache GET requests
    if (req.method !== "GET" || !req.user || !req.user.id) {
      return next();
    }

    const userId = req.user.id;
    // Generate cache key specific to the user and the exact URL including query params
    const cacheKey = `cache:${userId}:${req.originalUrl}`;

    try {
      const cachedData = await redisCache.get(cacheKey);

      if (cachedData) {
        // Cache hit
        logger.debug("Cache hit", { userId, path: req.originalUrl });
        return res.json(cachedData);
      }

      // Cache miss: Intercept res.json to store the response before sending it
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Store in cache asynchronously
        redisCache.set(cacheKey, body, options.ttl).catch((err) =>
          logger.warn("Failed to set cache in middleware", {
            error: err.message,
          }),
        );

        return originalJson(body);
      };

      next();
    } catch (error) {
      // If cache checking fails, just proceed to the route
      logger.error("Cache Middleware Error", { error: error.message });
      next();
    }
  };
};

module.exports = { cacheMiddleware };
