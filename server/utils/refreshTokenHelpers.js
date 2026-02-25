const jwt = require("jsonwebtoken");
const logger = require("./logger");
const redisQueue = require("./redisQueue");

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-secret-key-change-in-production";
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || "30d";
const MAX_SESSIONS_PER_USER = 5;

// Parse duration string (e.g. "30d") to milliseconds
function parseDurationToMs(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}

const REFRESH_TOKEN_EXPIRATION_MS = parseDurationToMs(REFRESH_TOKEN_EXPIRATION);

/**
 * Get the Redis key for a user's refresh tokens
 */
function getRedisKey(userId) {
  return `refresh_tokens:${userId}`;
}

/**
 * Generate a refresh token and store it in Redis
 * Enforces max 5 sessions per user by evicting the oldest token
 */
async function generateRefreshToken(user) {
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRATION },
  );

  const client = redisQueue.client;
  if (!client || !redisQueue.isConnected) {
    logger.warn(
      "Redis not connected - refresh token generated but not stored in Redis",
    );
    return token;
  }

  try {
    const key = getRedisKey(user._id);
    const expiryScore = Date.now() + REFRESH_TOKEN_EXPIRATION_MS;

    // Add the new token with expiry timestamp as score
    await client.zAdd(key, { score: expiryScore, value: token });

    // Trim to keep only the latest MAX_SESSIONS_PER_USER tokens
    // zCard gets count, then remove oldest if over limit
    const count = await client.zCard(key);
    if (count > MAX_SESSIONS_PER_USER) {
      // Remove the oldest (lowest score = earliest expiry) tokens
      const removeCount = count - MAX_SESSIONS_PER_USER;
      await client.zRemRangeByRank(key, 0, removeCount - 1);
      logger.info("Evicted oldest refresh tokens", {
        userId: user._id.toString(),
        evicted: removeCount,
        remaining: MAX_SESSIONS_PER_USER,
      });
    }

    // Set TTL on the key to auto-cleanup (30 days + buffer)
    await client.expire(
      key,
      Math.ceil(REFRESH_TOKEN_EXPIRATION_MS / 1000) + 3600,
    );

    logger.debug("Refresh token stored in Redis", {
      userId: user._id.toString(),
      activeSessions: Math.min(count, MAX_SESSIONS_PER_USER),
    });
  } catch (error) {
    logger.error("Failed to store refresh token in Redis", {
      error: error.message,
      userId: user._id.toString(),
    });
  }

  return token;
}

/**
 * Validate a refresh token by verifying JWT and checking Redis
 */
async function validateRefreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);

    const client = redisQueue.client;
    if (!client || !redisQueue.isConnected) {
      logger.warn(
        "Redis not connected - cannot validate refresh token against store",
      );
      return null;
    }

    // Check if the token exists in the user's sorted set
    const score = await client.zScore(getRedisKey(payload.id), token);
    if (score === null) {
      logger.warn("Refresh token not found in Redis (revoked or evicted)", {
        userId: payload.id,
      });
      return null;
    }

    return payload;
  } catch (err) {
    logger.warn("Invalid refresh token", { error: err.message });
    return null;
  }
}

/**
 * Revoke a specific refresh token from Redis
 */
async function revokeRefreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    const client = redisQueue.client;

    if (client && redisQueue.isConnected) {
      await client.zRem(getRedisKey(payload.id), token);
      logger.debug("Refresh token revoked", { userId: payload.id });
    }
  } catch (err) {
    // Token might be expired/invalid, try to decode without verification
    try {
      const decoded = jwt.decode(token);
      if (decoded?.id) {
        const client = redisQueue.client;
        if (client && redisQueue.isConnected) {
          await client.zRem(getRedisKey(decoded.id), token);
        }
      }
    } catch (decodeErr) {
      logger.warn("Could not revoke refresh token", { error: err.message });
    }
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
async function revokeAllUserTokens(userId) {
  const client = redisQueue.client;
  if (!client || !redisQueue.isConnected) {
    logger.warn("Redis not connected - cannot revoke all tokens");
    return;
  }

  try {
    await client.del(getRedisKey(userId));
    logger.info("All refresh tokens revoked for user", {
      userId: userId.toString(),
    });
  } catch (error) {
    logger.error("Failed to revoke all user tokens", {
      error: error.message,
      userId: userId.toString(),
    });
  }
}

module.exports = {
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  REFRESH_TOKEN_EXPIRATION_MS,
};
