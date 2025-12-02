const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const emailService = require("../utils/emailService");

const router = express.Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

// User Profile Routes
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: "An account with this email address already exists",
          errorType: "USER_EXISTS",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new User({
        name,
        email,
        password: hashedPassword,
      });

      await user.save();

      // Send welcome email (non-blocking)
      emailService.sendWelcomeEmail(user).catch(() => {
        // Email send failure is non-critical, silently fail
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Login route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          error: "No account found with this email address",
          errorType: "USER_NOT_FOUND",
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Incorrect password. Please try again.",
          errorType: "INVALID_PASSWORD",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Request password reset
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({
          message:
            "If an account exists with this email, a password reset link has been sent.",
        });
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { id: user._id, email: user.email, type: "password_reset" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Create reset URL
      const resetUrl = `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/reset-password?token=${resetToken}`;

      // Send password reset email
      await emailService.sendPasswordResetEmail(user, resetToken, resetUrl);

      res.json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to process password reset request" });
    }
  }
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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
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
        return res.status(400).json({
          error: "Invalid or expired reset token",
        });
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({
        message:
          "Password reset successful. You can now login with your new password.",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
