const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const logger = require("../utils/logger");

const router = express.Router();

// Middleware to check if request is from localhost only
const isLocalhostOnly = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocalhost = 
    ip === "127.0.0.1" || 
    ip === "::1" || 
    ip === "::ffff:127.0.0.1" ||
    (typeof ip === "string" && ip.includes("127.0.0.1"));
  
  if (!isLocalhost) {
    logger.warn("Unauthorized internal endpoint access attempt", {
      ip,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ 
      error: "This endpoint is only accessible from localhost" 
    });
  }
  next();
};

/**
 * POST /api/admin/internal/create-admin
 * Create an admin user - INTERNAL ONLY (localhost only)
 * This endpoint is meant for initial setup and bootstrapping
 * No authentication required - call from localhost only
 */
router.post("/create-admin", isLocalhostOnly, async (req, res) => {
  const startTime = Date.now();
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: "name, email, and password are required" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        error: "User with this email already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser = new User({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      storageLimit: -1, // Unlimited storage for admin
      storageUsed: 0,
    });

    await adminUser.save();

    logger.info("Internal admin user created successfully", {
      userId: adminUser._id,
      email: adminUser.email,
      createdVia: "internal-endpoint",
      ip: req.ip,
      duration: Date.now() - startTime,
    });

    res.status(201).json({
      message: "Admin user created successfully",
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    logger.logError(error, {
      operation: "internal-create-admin",
      ip: req.ip,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/internal/promote-user
 * Promote an existing user to admin - INTERNAL ONLY (localhost only)
 * No authentication required - call from localhost only
 */
router.post("/promote-user", isLocalhostOnly, async (req, res) => {
  try {
    const { email, newRole = "admin" } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    if (!["admin", "family", "user"].includes(newRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = newRole;
    await user.save();

    logger.info("Internal user role update", {
      userId: user._id,
      newRole,
      ip: req.ip,
    });

    res.json({
      message: `User promoted to ${newRole} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.logError(error, {
      operation: "internal-promote-user",
      ip: req.ip,
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
