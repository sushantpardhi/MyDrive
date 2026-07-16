const logger = require("./logger");

/**
 * Validate required environment variables on startup
 * Helps catch configuration issues early before the app starts
 */
const validateRequiredEnvVars = () => {
  logger.info("Validating environment variables...");

  // Required environment variables
  const required = ["JWT_SECRET", "REFRESH_TOKEN_SECRET", "MONGODB_URI"];

  // Check for missing required variables
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error("Missing required environment variables", {
      missing,
      hint: "Check your .env file against .env.example",
    });
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Validate token secret strength for both access and refresh tokens
  const tokenSecrets = [
    {
      envKey: "JWT_SECRET",
      value: process.env.JWT_SECRET,
      defaultSecret: "your-secret-key-change-in-production",
    },
    {
      envKey: "REFRESH_TOKEN_SECRET",
      value: process.env.REFRESH_TOKEN_SECRET,
      defaultSecret: "refresh-secret-key-change-in-production",
    },
  ];

  tokenSecrets.forEach(({ envKey, value, defaultSecret }) => {
    if (!value) {
      return;
    }

    if (value.length < 32) {
      logger.warn(`⚠️  ${envKey} should be at least 32 characters long`, {
        currentLength: value.length,
        recommendation: "Generate a stronger secret for production",
      });
    }

    const weakSecrets = [defaultSecret, "secret", "password", "changeme"];
    if (weakSecrets.includes(value.toLowerCase())) {
      logger.error(`⛔ Insecure ${envKey} detected`, {
        error: `Using default or weak ${envKey}`,
        action: `Change ${envKey} to a strong random string`,
      });
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `Cannot start in production with weak ${envKey}. Please update your .env file.`
        );
      }
    }
  });

  // Validate MongoDB URI format
  if (process.env.MONGODB_URI) {
    if (
      !process.env.MONGODB_URI.startsWith("mongodb://") &&
      !process.env.MONGODB_URI.startsWith("mongodb+srv://")
    ) {
      logger.warn("⚠️  MONGODB_URI format may be invalid", {
        hint: "Should start with mongodb:// or mongodb+srv://",
      });
    }
  }

  // Validate numeric environment variables
  const numericVars = [
    "PORT",
    "CHUNK_SIZE",
    "MAX_CHUNK_SIZE",
    "UPLOAD_TIMEOUT",
    "SESSION_LOOKUP_TIMEOUT",
  ];

  numericVars.forEach((key) => {
    if (process.env[key] && isNaN(parseInt(process.env[key]))) {
      logger.warn(`⚠️  ${key} should be a number`, {
        currentValue: process.env[key],
        hint: "Will use default value",
      });
    }
  });

  // Warn about optional but recommended variables
  const recommended = ["EMAIL_USER", "CLIENT_URL", "CORS_ORIGIN"];
  const missingRecommended = recommended.filter((key) => !process.env[key]);

  if (missingRecommended.length > 0) {
    logger.warn("Optional environment variables not set", {
      missing: missingRecommended,
      impact: "Some features may be limited",
      hint: "Check .env.example for configuration options",
    });
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    logger.info("Running production environment checks...");

    // Ensure CORS is properly configured in production
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
      logger.warn(
        "⚠️  CORS_ORIGIN should be set to your domain in production",
        {
          currentValue: process.env.CORS_ORIGIN || "*",
          recommendation:
            "Set to your frontend domain (e.g., https://yourdomain.com)",
        }
      );
    }

    // Ensure CLIENT_URL is set in production
    if (!process.env.CLIENT_URL) {
      logger.warn("⚠️  CLIENT_URL not set in production", {
        impact: "Email links may not work correctly",
      });
    }
  }

  logger.info("✅ Environment validation passed");
};

/**
 * Get configuration summary (for logging, excludes sensitive values)
 */
const getConfigSummary = () => {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 8080,
    mongodbConfigured: !!process.env.MONGODB_URI,
    emailConfigured: !!(process.env.EMAIL_USER || process.env.SMTP_HOST),
    corsOrigin: process.env.CORS_ORIGIN || "*",
    chunkSize: process.env.CHUNK_SIZE
      ? parseInt(process.env.CHUNK_SIZE)
      : 1048576,
    uploadTimeout: process.env.UPLOAD_TIMEOUT
      ? parseInt(process.env.UPLOAD_TIMEOUT)
      : 600000,
  };
};

module.exports = {
  validateRequiredEnvVars,
  getConfigSummary,
};
