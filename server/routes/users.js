const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const File = require("../models/File");
const Folder = require("../models/Folder");
const logger = require("../utils/logger");

const router = express.Router();

// User Profile Routes
router.get("/profile", async (req, res) => {
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

router.put("/profile", async (req, res) => {
  try {
    const { name, settings, preferences } = req.body;
    const update = {};
    if (name) update.name = name;
    if (settings) update.settings = settings;
    if (preferences) update.preferences = preferences;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get storage statistics
router.get("/storage", async (req, res) => {
  try {
    logger.info("Fetching storage stats", { userId: req.user.id });

    // Get user data
    const user = await User.findById(req.user.id).select(
      "storageUsed storageLimit"
    );
    if (!user) {
      logger.error("User not found for storage stats", { userId: req.user.id });
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate actual storage from files (excluding trash)
    const fileStats = await File.aggregate([
      {
        $match: {
          owner: user._id,
          trash: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" },
          count: { $sum: 1 },
        },
      },
    ]);

    const actualStorageUsed = fileStats.length > 0 ? fileStats[0].totalSize : 0;
    const filesCount = fileStats.length > 0 ? fileStats[0].count : 0;

    // Count folders (excluding trash)
    const foldersCount = await Folder.countDocuments({
      owner: user._id,
      trash: false,
    });

    // Update user's storageUsed if it doesn't match
    if (user.storageUsed !== actualStorageUsed) {
      logger.info("Updating user storageUsed", {
        userId: req.user.id,
        oldValue: user.storageUsed,
        newValue: actualStorageUsed,
      });
      await User.findByIdAndUpdate(req.user.id, {
        storageUsed: actualStorageUsed,
      });
    }

    const storageLimit = user.storageLimit || 5 * 1024 * 1024 * 1024; // Default 5GB
    const percentage =
      storageLimit > 0 ? (actualStorageUsed / storageLimit) * 100 : 0;

    const storageStats = {
      storageUsed: actualStorageUsed,
      storageLimit: storageLimit,
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      filesCount,
      foldersCount,
    };

    logger.debug("Storage stats calculated", {
      userId: req.user.id,
      ...storageStats,
    });

    res.json(storageStats);
  } catch (error) {
    logger.error("Error fetching storage stats", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Search users by email or name
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Query must be at least 2 characters" });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.id } }, // Exclude current user
        {
          $or: [
            { email: new RegExp(query, "i") },
            { name: new RegExp(query, "i") },
          ],
        },
      ],
    })
      .select("name email")
      .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify user password
router.post("/verify-password", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      logger.warn("Password verification attempted without password", {
        userId: req.user.id,
        ip: req.ip,
      });
      return res.status(400).json({ error: "Password is required" });
    }

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      logger.error("User not found for password verification", {
        userId: req.user.id,
      });
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logger.warn("Password verification failed - Incorrect password", {
        userId: req.user.id,
        email: user.email,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Incorrect password" });
    }

    logger.info("Password verified successfully", {
      userId: req.user.id,
      email: user.email,
      ip: req.ip,
    });

    res.json({ success: true, message: "Password verified" });
  } catch (error) {
    logger.error("Error verifying password", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
