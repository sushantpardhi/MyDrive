const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

/**
 * Rate limiter for upload endpoints
 * Limits to 500 uploads per 15 minutes per user (allows batch uploads like 179 files)
 * This is per individual file, not per chunk
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 uploads per user (5.5 per second, safe for 15 concurrent)
  keyGenerator: (req) => {
    // Use user ID as key if authenticated, otherwise use IP
    return req.user?.id || ipKeyGenerator(req);
  },
  message: "Too many uploads initiated, please try again later",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for chunked upload chunk uploads (already in progress)
    // Only limit the initiate endpoint
    return !req.path.includes("/chunked-upload/initiate") &&
           !req.path.includes("/upload");
  },
});

/**
 * Rate limiter for download endpoints
 * Limits to 50 downloads per minute per user
 */
const downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 downloads per minute per user
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  message: "Too many downloads, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for chunk downloads during active downloads
    // Only limit file initiation and verification
    return req.path.includes("/chunked-download") &&
           !req.path.includes("/initiate");
  },
});

/**
 * Rate limiter for chunked upload chunk endpoints
 * More lenient - limits to 1000 chunk uploads per 10 minutes (allows parallel)
 */
const chunkUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1000, // 1000 chunk uploads per user
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  message: "Too many chunk uploads, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Only apply to chunk upload endpoint
  skip: (req) => {
    return !req.path.includes("/chunked-upload") ||
           req.path.includes("/chunked-upload/initiate");
  },
});

/**
 * Rate limiter for authentication endpoints
 * Strict limits to prevent brute force attacks
 * 5 failed attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  keyGenerator: (req) => ipKeyGenerator(req),
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Rate limiter for API endpoints (general)
 * Limits to 100 requests per minute per user
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file sharing endpoints
 * Limits to 20 share actions per 10 minutes per user (prevents spam)
 */
const shareLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 share actions
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req);
  },
  message: "Too many share requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  uploadLimiter,
  downloadLimiter,
  chunkUploadLimiter,
  authLimiter,
  apiLimiter,
  shareLimiter,
};
