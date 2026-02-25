const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("./logger");
const redisQueue = require("./redisQueue");

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-secret-key-change-in-production";
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || "30d";

const SESSION_PREFIX = "auth:sessions:";
const MAX_SESSIONS = 5;

async function generateRefreshToken(user) {
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRATION },
  );

  const userIdStr = user._id.toString();
  const key = `${SESSION_PREFIX}${userIdStr}`;

  if (redisQueue.isConnected && redisQueue.client) {
    try {
      await redisQueue.client.lPush(key, token);
      await redisQueue.client.lTrim(key, 0, MAX_SESSIONS - 1);
      // Expiration of 30 days (2592000 seconds)
      await redisQueue.client.expire(key, 2592000);
    } catch (err) {
      logger.error("Failed to store refresh token in Redis", {
        error: err.message,
      });
    }
  } else {
    logger.warn(
      "Redis not connected, acting statelessly for refresh token generation",
    );
  }

  return token;
}

async function validateRefreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);

    if (redisQueue.isConnected && redisQueue.client) {
      const key = `${SESSION_PREFIX}${payload.id}`;
      const tokens = await redisQueue.client.lRange(key, 0, -1);
      if (!tokens.includes(token)) {
        logger.warn(
          "Refresh token not found in Redis (revoked or oldest session removed)",
          { userId: payload.id },
        );
        return null;
      }
    }

    return payload;
  } catch (err) {
    logger.warn("Invalid refresh token", { error: err.message });
    return null;
  }
}

async function revokeRefreshToken(token) {
  try {
    // Decode without verifying expiration to revoke expired tokens
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      ignoreExpiration: true,
    });
    if (redisQueue.isConnected && redisQueue.client) {
      const key = `${SESSION_PREFIX}${payload.id}`;
      // Remove exactly 1 matching token
      await redisQueue.client.lRem(key, 1, token);
    }
  } catch (err) {
    logger.warn("Could not decode token for revocation", {
      error: err.message,
    });
  }
}

async function revokeAllUserTokens(userId) {
  if (redisQueue.isConnected && redisQueue.client) {
    const key = `${SESSION_PREFIX}${userId}`;
    await redisQueue.client.del(key);
  }
}

module.exports = {
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
