const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const logger = require("./logger");

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-secret-key-change-in-production";
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || "30d";

// In-memory store for refresh tokens (for demo; use DB in production)
const refreshTokens = new Map();

function generateRefreshToken(user) {
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRATION }
  );
  refreshTokens.set(token, user._id.toString());
  return token;
}

function validateRefreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (refreshTokens.has(token)) {
      return payload;
    }
    return null;
  } catch (err) {
    logger.warn("Invalid refresh token", { error: err.message });
    return null;
  }
}

function revokeRefreshToken(token) {
  refreshTokens.delete(token);
}

function revokeAllUserTokens(userId) {
  for (const [token, uid] of refreshTokens.entries()) {
    if (uid === userId.toString()) {
      refreshTokens.delete(token);
    }
  }
}

module.exports = {
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
