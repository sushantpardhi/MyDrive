const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const emailService = require("../utils/emailService");
const logger = require("../utils/logger");
const {
  generateRefreshToken,
  revokeAllUserTokens,
} = require("../utils/refreshTokenHelpers");

const router = express.Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

// Logout route (invalidate refresh token)
router.post("/logout", (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (refreshToken) {
    const { revokeRefreshToken } = require("../utils/refreshTokenHelpers");
    revokeRefreshToken(refreshToken);
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out successfully" });
});
// Refresh token endpoint
router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }
    const { validateRefreshToken } = require("../utils/refreshTokenHelpers");
    const payload = validateRefreshToken(refreshToken);
    if (!payload) {
      return res
        .status(403)
        .json({ error: "Invalid or expired refresh token" });
    }
    // Issue new access token
    const token = jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION },
    );
    res.json({ token });
  } catch (error) {
    logger.logError(error, { operation: "refresh-token", ip: req.ip });
    res.status(500).json({ error: error.message });
  }
});

// User Profile Routes
router.get("/me", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      logger.warn(
        `Profile fetch failed - User not found: ${req.user.id} - IP: ${req.ip}`,
      );
      return res.status(404).json({ error: "User not found" });
    }
    logger.logAuth("profile-fetch", user._id, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
      email: user.email,
    });
    res.json(user);
  } catch (error) {
    logger.logError(error, {
      operation: "profile-fetch",
      userId: req.user.id,
      ip: req.ip,
    });
    res.status(500).json({ error: error.message });
  } finally {
    logger.logPerformance("profile-fetch", Date.now() - startTime);
  }
});

// Register route
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("user-agent");

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `Registration failed - Validation errors: ${JSON.stringify(
            errors.array(),
          )} - IP: ${ip}`,
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        logger.warn(
          `Registration failed - Email already exists: ${email} - IP: ${ip}`,
        );
        return res.status(409).json({
          error: "An account with this email address already exists",
          errorType: "USER_EXISTS",
        });
      }

      // Validate role if provided (default is 'user')
      const validRoles = ["admin", "family", "user", "guest"];
      const userRole = role && validRoles.includes(role) ? role : "user";

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with role
      const user = new User({
        name,
        email,
        password: hashedPassword,
        role: userRole,
      });

      await user.save();

      logger.info("User registered with role", {
        userId: user._id,
        email: user.email,
        role: user.role,
        storageLimit: user.storageLimit,
      });

      logger.logAuth("register", user._id, {
        ip,
        userAgent,
        email,
        success: true,
      });

      // Send welcome email (non-blocking)
      emailService.sendWelcomeEmail(user).catch((emailError) => {
        logger.warn(
          `Welcome email failed for user ${user._id}: ${emailError.message}`,
        );
      });

      // Generate JWT access token
      const token = jwt.sign(
        { id: user._id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION },
      );
      // Generate refresh token
      const refreshToken = generateRefreshToken(user);
      // Set refresh token as HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      logger.logPerformance("register", Date.now() - startTime, {
        userId: user._id,
      });

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          storageLimit: user.storageLimit,
          storageUsed: user.storageUsed,
        },
      });
    } catch (error) {
      logger.logError(error, {
        operation: "register",
        ip: req.ip,
        additionalInfo: req.body.email,
      });
      res.status(500).json({ error: error.message });
    }
  },
);

// Login route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("user-agent");

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `Login failed - Validation errors: ${JSON.stringify(
            errors.array(),
          )} - IP: ${ip}`,
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        logger.logAuth("login", null, {
          ip,
          userAgent,
          email,
          success: false,
          additionalInfo: "User not found",
        });
        return res.status(404).json({
          error: "No account found with this email address",
          errorType: "USER_NOT_FOUND",
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.logAuth("login", user._id, {
          ip,
          userAgent,
          email,
          success: false,
          additionalInfo: "Invalid password",
        });
        return res.status(401).json({
          error: "Incorrect password. Please try again.",
          errorType: "INVALID_PASSWORD",
        });
      }

      // Generate JWT access token
      const token = jwt.sign(
        { id: user._id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION },
      );
      // Generate refresh token
      const refreshToken = generateRefreshToken(user);
      // Set refresh token as HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      logger.logAuth("login", user._id, {
        ip,
        userAgent,
        email,
        role: user.role,
        success: true,
      });

      logger.logPerformance("login", Date.now() - startTime, {
        userId: user._id,
      });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          storageLimit: user.storageLimit,
          storageUsed: user.storageUsed,
        },
      });
    } catch (error) {
      logger.logError(error, {
        operation: "login",
        ip: req.ip,
        additionalInfo: req.body.email,
      });
      res.status(500).json({ error: error.message });
    }
  },
);

// Request password reset
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required")],
  async (req, res) => {
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `Forgot password failed - Validation errors: ${JSON.stringify(
            errors.array(),
          )} - IP: ${ip}`,
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.info(
          `Password reset requested for non-existent email: ${email} - IP: ${ip}`,
        );
        return res.json({
          message:
            "If an account exists with this email, a password reset link has been sent.",
        });
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { id: user._id, email: user.email, type: "password_reset" },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      // Create reset URL
      const resetUrl = `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/reset-password?token=${resetToken}`;

      // Send password reset email
      await emailService.sendPasswordResetEmail(user, resetToken, resetUrl);

      logger.logAuth("password-reset-request", user._id, {
        ip,
        email,
        success: true,
      });

      logger.logPerformance("forgot-password", Date.now() - startTime, {
        userId: user._id,
      });

      res.json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error) {
      logger.logError(error, {
        operation: "forgot-password",
        ip: req.ip,
        additionalInfo: req.body.email,
      });
      res
        .status(500)
        .json({ error: "Failed to process password reset request" });
    }
  },
);

// Reset password with token
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `Password reset failed - Validation errors: ${JSON.stringify(
            errors.array(),
          )} - IP: ${ip}`,
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, newPassword } = req.body;

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== "password_reset") {
          throw new Error("Invalid token type");
        }
      } catch (error) {
        logger.warn(`Password reset failed - Invalid token - IP: ${ip}`);
        return res.status(400).json({
          error: "Invalid or expired reset token",
        });
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        logger.warn(
          `Password reset failed - User not found: ${decoded.id} - IP: ${ip}`,
        );
        return res.status(404).json({ error: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      logger.logAuth("password-reset", user._id, {
        ip,
        email: user.email,
        success: true,
      });

      logger.logPerformance("reset-password", Date.now() - startTime, {
        userId: user._id,
      });

      res.json({
        message:
          "Password reset successful. You can now login with your new password.",
      });
    } catch (error) {
      logger.logError(error, { operation: "reset-password", ip: req.ip });
      res.status(500).json({ error: error.message });
    }
  },
);

module.exports = router;
