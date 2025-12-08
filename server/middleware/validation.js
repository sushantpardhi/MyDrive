const { validationResult } = require("express-validator");
const logger = require("../utils/logger");

/**
 * Validation middleware for express-validator
 * Checks validation results and returns formatted errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array();

    logger.warn("Request validation failed", {
      path: req.path,
      method: req.method,
      errors: errorDetails,
      ip: req.ip || req.connection.remoteAddress,
    });

    return res.status(400).json({
      error: "Validation failed",
      details: errorDetails.map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }

  next();
};

/**
 * Common validation chains for reuse across routes
 */
const commonValidations = {
  // Pagination validators
  page: {
    in: ["query"],
    isInt: {
      options: { min: 1 },
      errorMessage: "Page must be a positive integer",
    },
    toInt: true,
    optional: true,
  },
  limit: {
    in: ["query"],
    isInt: {
      options: { min: 1, max: 100 },
      errorMessage: "Limit must be between 1 and 100",
    },
    toInt: true,
    optional: true,
  },

  // MongoDB ObjectId validator
  objectId: (fieldName = "id") => ({
    in: ["params", "body", "query"],
    matches: {
      options: [/^[0-9a-fA-F]{24}$/],
      errorMessage: `${fieldName} must be a valid MongoDB ObjectId`,
    },
  }),

  // Email validator
  email: {
    in: ["body"],
    isEmail: {
      errorMessage: "Must be a valid email address",
    },
    normalizeEmail: true,
    trim: true,
  },

  // Password validator
  password: {
    in: ["body"],
    isLength: {
      options: { min: 6 },
      errorMessage: "Password must be at least 6 characters long",
    },
    trim: true,
  },

  // File/Folder name validator
  name: {
    in: ["body"],
    trim: true,
    notEmpty: {
      errorMessage: "Name is required",
    },
    isLength: {
      options: { max: 255 },
      errorMessage: "Name must not exceed 255 characters",
    },
    // Prevent path traversal attacks
    custom: {
      options: (value) => {
        if (
          value.includes("..") ||
          value.includes("/") ||
          value.includes("\\")
        ) {
          throw new Error(
            "Name cannot contain path separators or parent directory references"
          );
        }
        return true;
      },
    },
  },
};

module.exports = {
  validate,
  commonValidations,
};
