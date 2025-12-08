const logger = require("../utils/logger");

/**
 * Middleware to check if user has required role(s)
 * @param {String|Array} roles - Single role or array of allowed roles
 * @returns {Function} - Express middleware function
 */
function requireRole(roles) {
  return (req, res, next) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // Check if user exists in request (set by authenticateToken middleware)
    if (!req.user) {
      logger.warn("Role check failed - No user in request", {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Role authorization failed", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        ip: req.ip,
        path: req.path,
      });
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of the following roles: ${allowedRoles.join(
          ", "
        )}`,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    logger.debug("Role authorization passed", {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: allowedRoles,
    });

    next();
  };
}

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

/**
 * Middleware to check if user is admin or family
 */
function requireAdminOrFamily(req, res, next) {
  return requireRole(["admin", "family"])(req, res, next);
}

module.exports = {
  requireRole,
  requireAdmin,
  requireAdminOrFamily,
};
