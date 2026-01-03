const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
dotenv.config();

// Import logger
const logger = require("./utils/logger");

// Import and validate environment variables
const {
  validateRequiredEnvVars,
  getConfigSummary,
} = require("./utils/envValidator");
try {
  validateRequiredEnvVars();
} catch (error) {
  logger.error("Environment validation failed", { error: error.message });
  process.exit(1);
}

// Import middleware
const { authenticateToken } = require("./middleware/auth");
const { requestLogger, errorLogger } = require("./middleware/requestLogger");

// Import cleanup scheduler
const { initializeCleanupScheduler } = require("./utils/cleanupScheduler");

// Import email configuration
const { verifyEmailConfig } = require("./config/emailConfig");

// Import routes
const authRouter = require("./routes/auth");
const filesRouter = require("./routes/files");
const foldersRouter = require("./routes/folders");
const usersRouter = require("./routes/users");
const sharedRouter = require("./routes/shared");
const adminRouter = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 8080;
const UPLOAD_TIMEOUT = process.env.UPLOAD_TIMEOUT
  ? parseInt(process.env.UPLOAD_TIMEOUT)
  : 600000; // 10 minutes default
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow thumbnail loading
  })
); // Security headers
app.use(mongoSanitize()); // Prevent MongoDB injection
app.use(compression()); // Response compression

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Limit each IP to 100000 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
    });
    res.status(429).json({
      error: "Too many requests from this IP, please try again later",
    });
  },
});

// Apply rate limiting to API routes
app.use("/api/", apiLimiter);

// Request logging middleware
app.use(requestLogger);

// Set server timeout for long-running operations
app.use((req, res, next) => {
  // Set timeout for chunked upload operations
  if (req.path.includes("chunked-upload")) {
    req.setTimeout(UPLOAD_TIMEOUT);
    res.setTimeout(UPLOAD_TIMEOUT);
  }
  next();
});

// MongoDB connection with resilience settings
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/mydrive";

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  })
  .catch((err) => {
    logger.error("Initial MongoDB connection failed", {
      error: err.message,
      uri: MONGODB_URI.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@"), // Hide credentials in logs
    });
    process.exit(1);
  });

// Health check endpoint (before auth middleware)
app.get("/health", async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: "ok",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    environment: process.env.NODE_ENV || "development",
  };

  const statusCode = health.mongodb === "connected" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/files", authenticateToken, filesRouter);
app.use("/api/folders", authenticateToken, foldersRouter);
app.use("/api/users", authenticateToken, usersRouter);
app.use("/api/shared", authenticateToken, sharedRouter);
app.use("/api/admin", authenticateToken, adminRouter);
app.use("/api", authenticateToken, sharedRouter); // For /api/search and /api/trash/empty

app.get("/", (req, res) => {
  res.send(
    `MyDrive Backend is running in ${
      process.env.NODE_ENV || "development"
    } mode.`
  );
});

// Initialize cleanup scheduler after database connection
mongoose.connection.once("open", async () => {
  logger.info(`Connected to MongoDB - Database: ${MONGODB_URI}`);
  initializeCleanupScheduler();

  // Verify email configuration
  await verifyEmailConfig();
});

// Error logging middleware (should be after routes)
app.use(errorLogger);

// Handle MongoDB connection errors
mongoose.connection.on("error", (error) => {
  logger.logError(error, {
    operation: "MongoDB Connection",
    additionalInfo: MONGODB_URI,
  });
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected successfully");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  const config = getConfigSummary();
  logger.info(
    `🚀 Server started - Port: ${PORT} - Environment: ${
      process.env.NODE_ENV || "development"
    } - CORS: ${CORS_ORIGIN}`
  );
  logger.info(`📦 Upload timeout: ${UPLOAD_TIMEOUT}ms - JSON limit: 10mb`);
  logger.info(
    `🔒 Security: Helmet, Rate Limiting, MongoDB Sanitization enabled`
  );
  logger.info(`📧 Email configured: ${config.emailConfigured}`);
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received: closing HTTP server gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason,
    promise,
  });
});
