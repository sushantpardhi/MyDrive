const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Guest session configuration (can be overridden via env)
const GUEST_SESSION_DURATION =
  parseInt(process.env.GUEST_SESSION_DURATION) || 30 * 60 * 1000; // 30 minutes
const GUEST_SESSION_EXTENSION =
  parseInt(process.env.GUEST_SESSION_EXTENSION) || 15 * 60 * 1000; // 15 minutes
const GUEST_MAX_EXTENSIONS = parseInt(process.env.GUEST_MAX_EXTENSIONS) || 3;
const GUEST_STORAGE_LIMIT =
  parseInt(process.env.GUEST_STORAGE_LIMIT) || 500 * 1024 * 1024; // 500MB

const GuestSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  extensionCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "expired", "converted"],
    default: "active",
  },
});

// Index for efficient cleanup queries
GuestSessionSchema.index({ expiresAt: 1, status: 1 });
GuestSessionSchema.index({ userId: 1 });

/**
 * Create a new guest session with default expiry
 * @param {ObjectId} userId - The temporary guest user ID
 * @returns {Promise<GuestSession>} The created session
 */
GuestSessionSchema.statics.createSession = async function (userId) {
  const expiresAt = new Date(Date.now() + GUEST_SESSION_DURATION);

  const session = new this({
    userId,
    expiresAt,
    extensionCount: 0,
    status: "active",
  });

  await session.save();

  logger.info("Guest session created", {
    sessionId: session._id,
    userId,
    expiresAt,
  });

  return session;
};

/**
 * Extend a guest session
 * @param {ObjectId} sessionId - The session to extend
 * @returns {Promise<GuestSession|null>} The updated session or null if max extensions reached
 */
GuestSessionSchema.statics.extendSession = async function (sessionId) {
  const session = await this.findById(sessionId);

  if (!session) {
    logger.warn("Attempt to extend non-existent guest session", { sessionId });
    return null;
  }

  if (session.status !== "active") {
    logger.warn("Attempt to extend non-active guest session", {
      sessionId,
      status: session.status,
    });
    return null;
  }

  if (session.extensionCount >= GUEST_MAX_EXTENSIONS) {
    logger.warn("Guest session max extensions reached", {
      sessionId,
      extensionCount: session.extensionCount,
    });
    return null;
  }

  // Extend from current time or current expiry, whichever is later
  const baseTime = Math.max(Date.now(), session.expiresAt.getTime());
  session.expiresAt = new Date(baseTime + GUEST_SESSION_EXTENSION);
  session.extensionCount += 1;

  await session.save();

  logger.info("Guest session extended", {
    sessionId,
    newExpiresAt: session.expiresAt,
    extensionCount: session.extensionCount,
  });

  return session;
};

/**
 * Mark session as converted to full account
 * @param {ObjectId} sessionId - The session to convert
 * @returns {Promise<GuestSession|null>} The updated session
 */
GuestSessionSchema.statics.convertSession = async function (sessionId) {
  const session = await this.findByIdAndUpdate(
    sessionId,
    { status: "converted" },
    { new: true },
  );

  if (session) {
    logger.info("Guest session converted to full account", {
      sessionId,
      userId: session.userId,
    });
  }

  return session;
};

/**
 * Find expired active sessions
 * @returns {Promise<GuestSession[]>} Array of expired sessions
 */
GuestSessionSchema.statics.findExpiredSessions = async function () {
  return this.find({
    status: "active",
    expiresAt: { $lt: new Date() },
  });
};

/**
 * Check if a session is valid (active and not expired)
 * @param {ObjectId} sessionId - The session to check
 * @returns {Promise<boolean>} True if valid
 */
GuestSessionSchema.statics.isSessionValid = async function (sessionId) {
  const session = await this.findById(sessionId);

  if (!session) {
    return false;
  }

  return session.status === "active" && session.expiresAt > new Date();
};

/**
 * Get session status with remaining time
 * @param {ObjectId} sessionId - The session to check
 * @returns {Promise<Object|null>} Session status object
 */
GuestSessionSchema.statics.getSessionStatus = async function (sessionId) {
  const session = await this.findById(sessionId);

  if (!session) {
    return null;
  }

  const now = Date.now();
  const expiresAtMs = session.expiresAt.getTime();
  const remainingMs = Math.max(0, expiresAtMs - now);

  return {
    sessionId: session._id,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
    extensionCount: session.extensionCount,
    maxExtensions: GUEST_MAX_EXTENSIONS,
    canExtend:
      session.extensionCount < GUEST_MAX_EXTENSIONS &&
      session.status === "active",
    isExpired: remainingMs <= 0 || session.status === "expired",
  };
};

/**
 * Cleanup expired sessions (mark as expired)
 * @returns {Promise<Object>} Cleanup result
 */
GuestSessionSchema.statics.markExpiredSessions = async function () {
  const result = await this.updateMany(
    {
      status: "active",
      expiresAt: { $lt: new Date() },
    },
    {
      status: "expired",
    },
  );

  if (result.modifiedCount > 0) {
    logger.info("Marked expired guest sessions", {
      count: result.modifiedCount,
    });
  }

  return result;
};

// Export configuration constants for use elsewhere
module.exports = mongoose.model("GuestSession", GuestSessionSchema);
module.exports.GUEST_SESSION_DURATION = GUEST_SESSION_DURATION;
module.exports.GUEST_SESSION_EXTENSION = GUEST_SESSION_EXTENSION;
module.exports.GUEST_MAX_EXTENSIONS = GUEST_MAX_EXTENSIONS;
module.exports.GUEST_STORAGE_LIMIT = GUEST_STORAGE_LIMIT;
