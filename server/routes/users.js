const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const User = require("../models/User");
const File = require("../models/File");
const Folder = require("../models/Folder");
const logger = require("../utils/logger");
const { formatBytes } = require("../utils/storageHelpers");
const { requireAdmin } = require("../middleware/roleAuth");

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const avatarDir = path.join(__dirname, "../uploads/avatars");
    try {
      await fs.mkdir(avatarDir, { recursive: true });
      cb(null, avatarDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.user.id}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

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
    const isUnlimited = storageLimit === -1;
    const percentage = isUnlimited
      ? 0
      : storageLimit > 0
      ? (actualStorageUsed / storageLimit) * 100
      : 0;

    const storageStats = {
      storageUsed: actualStorageUsed,
      storageLimit: storageLimit,
      isUnlimited,
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

// Change password
router.put("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      logger.warn("Password change failed - Incorrect current password", {
        userId: req.user.id,
      });
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    logger.info("Password changed successfully", { userId: req.user.id });
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    logger.error("Error changing password", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Upload avatar
router.post("/avatar", uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const oldAvatarPath = path.join(
        __dirname,
        "../uploads/avatars",
        path.basename(user.avatar)
      );
      try {
        await fs.unlink(oldAvatarPath);
      } catch (err) {
        logger.warn("Failed to delete old avatar", { error: err.message });
      }
    }

    // Save new avatar URL
    const avatarUrl = `/api/users/avatar/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();

    logger.info("Avatar uploaded successfully", {
      userId: req.user.id,
      filename: req.file.filename,
    });
    res.json({ message: "Avatar uploaded successfully", avatarUrl });
  } catch (error) {
    logger.error("Error uploading avatar", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Delete avatar
router.delete("/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.avatar) {
      return res.status(400).json({ error: "No avatar to delete" });
    }

    // Delete avatar file
    const avatarPath = path.join(
      __dirname,
      "../uploads/avatars",
      path.basename(user.avatar)
    );
    try {
      await fs.unlink(avatarPath);
    } catch (err) {
      logger.warn("Failed to delete avatar file", { error: err.message });
    }

    user.avatar = "";
    await user.save();

    logger.info("Avatar deleted successfully", { userId: req.user.id });
    res.json({ message: "Avatar deleted successfully" });
  } catch (error) {
    logger.error("Error deleting avatar", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Serve avatar images
router.get("/avatar/:filename", async (req, res) => {
  try {
    const avatarPath = path.join(
      __dirname,
      "../uploads/avatars",
      req.params.filename
    );
    res.sendFile(avatarPath);
  } catch (error) {
    res.status(404).json({ error: "Avatar not found" });
  }
});

// Get account statistics
router.get("/stats", async (req, res) => {
  try {
    logger.info("Fetching account stats", { userId: req.user.id });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Count files (excluding trash)
    const filesCount = await File.countDocuments({
      owner: user._id,
      trash: false,
    });

    // Count folders (excluding trash)
    const foldersCount = await Folder.countDocuments({
      owner: user._id,
      trash: false,
    });

    // Count shared items (files shared with user)
    const sharedItemsCount = await File.countDocuments({
      shared: user._id,
      trash: false,
    });

    const stats = {
      filesCount,
      foldersCount,
      sharedItemsCount,
      accountCreated: user.createdAt,
    };

    logger.debug("Account stats calculated", {
      userId: req.user.id,
      ...stats,
    });

    res.json(stats);
  } catch (error) {
    logger.error("Error fetching account stats", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Delete account
router.delete("/account", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Account deletion failed - Incorrect password", {
        userId: req.user.id,
      });
      return res.status(401).json({ error: "Incorrect password" });
    }

    logger.warn("Deleting user account", {
      userId: req.user.id,
      email: user.email,
    });

    // Delete all user files
    const userFiles = await File.find({ owner: user._id });
    for (const file of userFiles) {
      const filePath = path.join(__dirname, "../uploads", file.path);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        logger.warn("Failed to delete file", {
          fileId: file._id,
          error: err.message,
        });
      }
    }
    await File.deleteMany({ owner: user._id });

    // Delete all user folders
    await Folder.deleteMany({ owner: user._id });

    // Delete user's upload directory
    const userUploadDir = path.join(
      __dirname,
      "../uploads",
      user._id.toString()
    );
    try {
      await fs.rm(userUploadDir, { recursive: true, force: true });
    } catch (err) {
      logger.warn("Failed to delete user upload directory", {
        error: err.message,
      });
    }

    // Delete avatar if exists
    if (user.avatar) {
      const avatarPath = path.join(
        __dirname,
        "../uploads/avatars",
        path.basename(user.avatar)
      );
      try {
        await fs.unlink(avatarPath);
      } catch (err) {
        logger.warn("Failed to delete avatar", { error: err.message });
      }
    }

    // Delete user account
    await User.findByIdAndDelete(req.user.id);

    logger.info("User account deleted successfully", { userId: req.user.id });
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    logger.error("Error deleting account", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get user storage information
router.get("/storage", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "storageUsed storageLimit lastStorageNotificationLevel role"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const storageUsed = user.storageUsed || 0;
    const storageLimit = user.storageLimit || 5 * 1024 * 1024 * 1024; // 5GB default
    const isUnlimited = storageLimit === -1;
    const percentage = isUnlimited ? 0 : (storageUsed / storageLimit) * 100;
    const remainingSpace = isUnlimited ? -1 : storageLimit - storageUsed;

    const storageInfo = {
      used: storageUsed,
      limit: storageLimit,
      remaining: remainingSpace,
      percentage: Math.round(percentage * 100) / 100,
      formattedUsed: formatBytes(storageUsed),
      formattedLimit: isUnlimited ? "Unlimited" : formatBytes(storageLimit),
      formattedRemaining: isUnlimited
        ? "Unlimited"
        : formatBytes(remainingSpace),
      lastNotificationLevel: user.lastStorageNotificationLevel || 0,
      isNearLimit: !isUnlimited && percentage >= 75,
      isAtLimit: !isUnlimited && percentage >= 100,
      isUnlimited,
      role: user.role,
    };

    logger.debug("Storage info requested", {
      userId: req.user.id,
      role: user.role,
      isUnlimited,
      percentage: storageInfo.percentage,
    });

    res.json(storageInfo);
  } catch (error) {
    logger.error("Error fetching storage info", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Admin-only role management endpoints

/**
 * GET /api/users/all - Get all users (Admin only)
 */
router.get("/all", requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    logger.info("Admin fetched all users", {
      adminId: req.user.id,
      userCount: users.length,
    });

    res.json(users);
  } catch (error) {
    logger.error("Error fetching all users", {
      adminId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/users/:userId/role - Update user role (Admin only)
 */
router.put("/:userId/role", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ["admin", "family", "guest"];
    if (!role || !validRoles.includes(role)) {
      logger.warn("Invalid role update attempt", {
        adminId: req.user.id,
        targetUserId: userId,
        attemptedRole: role,
      });
      return res.status(400).json({
        error: "Invalid role",
        message: `Role must be one of: ${validRoles.join(", ")}`,
      });
    }

    // Prevent admin from changing their own role
    if (userId === req.user.id) {
      logger.warn("Admin attempted to change own role", {
        adminId: req.user.id,
      });
      return res.status(403).json({
        error: "Cannot change your own role",
        message: "Admins cannot modify their own role for security reasons.",
      });
    }

    // Find user and update role
    const user = await User.findById(userId);
    if (!user) {
      logger.warn("User not found for role update", {
        adminId: req.user.id,
        targetUserId: userId,
      });
      return res.status(404).json({ error: "User not found" });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save(); // This triggers the pre-save hook to update storageLimit

    logger.info("User role updated by admin", {
      adminId: req.user.id,
      targetUserId: userId,
      oldRole,
      newRole: role,
      newStorageLimit: user.storageLimit,
    });

    // Return updated user without password
    const updatedUser = await User.findById(userId).select("-password");
    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    logger.error("Error updating user role", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:userId - Get specific user details (Admin only)
 */
router.get("/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      logger.warn("User not found", {
        adminId: req.user.id,
        targetUserId: userId,
      });
      return res.status(404).json({ error: "User not found" });
    }

    logger.info("Admin fetched user details", {
      adminId: req.user.id,
      targetUserId: userId,
    });

    res.json(user);
  } catch (error) {
    logger.error("Error fetching user details", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
