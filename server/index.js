const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Import logger
const logger = require("./utils/logger");

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

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/mydrive";
mongoose.connect(MONGODB_URI);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/files", authenticateToken, filesRouter);
app.use("/api/folders", authenticateToken, foldersRouter);
app.use("/api/users", authenticateToken, usersRouter);
app.use("/api/shared", authenticateToken, sharedRouter);
app.use("/api", authenticateToken, sharedRouter); // For /api/search and /api/trash/empty

app.get("/", (req, res) => {
  res.send("MyDrive Backend is running.");
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
  logger.logError(error, { operation: "MongoDB Connection", additionalInfo: MONGODB_URI });
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected successfully");
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    `🚀 Server started - Port: ${PORT} - Environment: ${
      process.env.NODE_ENV || "development"
    } - CORS: ${CORS_ORIGIN}`
  );
  logger.info(`📦 Upload timeout: ${UPLOAD_TIMEOUT}ms - JSON limit: 10mb`);
});
