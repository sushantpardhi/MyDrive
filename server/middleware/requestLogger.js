const logger = require("../utils/logger");

/**
 * Middleware to log all incoming HTTP requests
 * Only logs errors (4xx, 5xx) and slow requests, not every API call
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log response when finished - only errors and slow requests
  res.on("finish", () => {
    const duration = Date.now() - startTime;

    // Only log if there's an error (4xx, 5xx) or request is slow (>5s)
    if (res.statusCode >= 400) {
      logger.warn(
        `${req.method} ${req.originalUrl} - ${
          res.statusCode
        } - ${duration}ms - User: ${req.user?.id || "anonymous"} - IP: ${
          req.ip
        }`
      );
    } else if (duration > 5000) {
      logger.warn(
        `SLOW REQUEST: ${req.method} ${req.originalUrl} - ${
          res.statusCode
        } - ${duration}ms - User: ${req.user?.id || "anonymous"} - IP: ${
          req.ip
        }`
      );
    }
  });

  next();
};

/**
 * Middleware to log errors
 */
const errorLogger = (err, req, res, next) => {
  logger.error(
    `Error on ${req.method} ${req.originalUrl} - User: ${
      req.user?.id || "anonymous"
    } - ${err.message}`
  );

  if (err.stack) {
    logger.debug(err.stack);
  }

  next(err);
};

module.exports = {
  requestLogger,
  errorLogger,
};
