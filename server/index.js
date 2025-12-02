const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Import middleware
const { authenticateToken } = require("./middleware/auth");

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
  if (process.env.NODE_ENV !== "production") {
    console.log("Connected to MongoDB");
  }
  initializeCleanupScheduler();

  // Verify email configuration
  await verifyEmailConfig();
});

app.listen(PORT, "0.0.0.0", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  }
});
