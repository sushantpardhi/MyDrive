const GuestSession = require("../models/GuestSession");
const logger = require("../utils/logger");

/**
 * Middleware to check if guest session is still valid
 * Should be used after authenticateToken for guest users
 */
const checkGuestSession = async (req, res, next) => {
  // Skip check if not a temporary guest
  if (!req.user?.isTemporaryGuest) {
    return next();
  }

  const sessionId = req.user.guestSessionId;
  if (!sessionId) {
    logger.warn("Guest user without session ID", { userId: req.user.id });
    return res.status(401).json({
      error: "Guest session not found",
      code: "GUEST_SESSION_NOT_FOUND",
    });
  }

  try {
    const isValid = await GuestSession.isSessionValid(sessionId);

    if (!isValid) {
      logger.info("Guest session expired", {
        userId: req.user.id,
        sessionId,
      });

      return res.status(401).json({
        error: "Guest session has expired",
        code: "GUEST_SESSION_EXPIRED",
        isExpired: true,
      });
    }

    next();
  } catch (error) {
    logger.logError(error, {
      operation: "check-guest-session",
      userId: req.user?.id,
      sessionId,
    });
    res.status(500).json({ error: "Failed to validate guest session" });
  }
};

/**
 * Middleware to block temporary guests from certain routes
 * Use this for features that guests shouldn't access
 */
const requireNonTemporaryGuest = (req, res, next) => {
  if (req.user?.isTemporaryGuest) {
    logger.warn("Temporary guest attempted restricted action", {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({
      error:
        "This feature is not available for guest sessions. Please create an account to access this feature.",
      code: "GUEST_NOT_ALLOWED",
      requiresAccount: true,
    });
  }

  next();
};

/**
 * Middleware factory to require non-temporary guest with custom message
 * @param {string} featureName - Name of the feature being restricted
 */
const requireNonTemporaryGuestFor = (featureName) => {
  return (req, res, next) => {
    if (req.user?.isTemporaryGuest) {
      logger.warn("Temporary guest attempted restricted action", {
        userId: req.user.id,
        feature: featureName,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        error: `${featureName} is not available for guest sessions. Please create an account to use this feature.`,
        code: "GUEST_NOT_ALLOWED",
        feature: featureName,
        requiresAccount: true,
      });
    }

    next();
  };
};

module.exports = {
  checkGuestSession,
  requireNonTemporaryGuest,
  requireNonTemporaryGuestFor,
};
