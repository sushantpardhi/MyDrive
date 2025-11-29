const express = require("express");
const fs = require("fs");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const {
  deletePhysicalFilesRecursively,
  shareContentsRecursively,
} = require("../utils/shareHelpers");
const emailService = require("../utils/emailService");

const router = express.Router();

// Get shared items (files and folders shared with the current user)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Find only top-level shared items (items shared directly, not inherited from parent folders)
    // For folders: only show folders that were directly shared
    // For files: only show files that were directly shared and whose parent is not a shared folder

    // First, get all shared folders to check parent relationships
    const allSharedFolders = await Folder.find({
      shared: req.user.id,
      trash: { $ne: true },
    }).select("_id parent");

    const sharedFolderIds = new Set(
      allSharedFolders.map((f) => f._id.toString())
    );

    // Get folders that are shared but their parent is not a shared folder (top-level shared folders)
    const topLevelSharedFolders = allSharedFolders.filter((folder) => {
      if (!folder.parent) return true; // Root level folders
      return !sharedFolderIds.has(folder.parent.toString());
    });

    // Get files that are shared but their parent is not a shared folder
    const fileQuery = {
      shared: req.user.id,
      trash: { $ne: true },
      $or: [
        { parent: null }, // Root level files
        { parent: { $nin: Array.from(sharedFolderIds) } }, // Files not in shared folders
      ],
    };

    const topLevelSharedFolderIds = topLevelSharedFolders.map((f) => f._id);
    const folderQuery = {
      _id: { $in: topLevelSharedFolderIds },
    };

    const totalFolders = topLevelSharedFolderIds.length;
    const totalFiles = await File.countDocuments(fileQuery);

    let folders = [];
    let files = [];

    if (skip < totalFolders) {
      const folderSkip = skip;
      const folderLimit = Math.min(limit, totalFolders - folderSkip);

      folders = await Folder.find(folderQuery)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(folderSkip)
        .limit(folderLimit);

      const remainingLimit = limit - folders.length;
      if (remainingLimit > 0) {
        files = await File.find(fileQuery)
          .populate("owner", "name email")
          .sort({ createdAt: -1 })
          .limit(remainingLimit);
      }
    } else {
      const fileSkip = skip - totalFolders;
      files = await File.find(fileQuery)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(fileSkip)
        .limit(limit);
    }

    res.json({
      folders,
      files,
      pagination: {
        page,
        limit,
        totalFolders,
        totalFiles,
        totalItems: totalFolders + totalFiles,
        hasMore:
          skip + folders.length + files.length < totalFolders + totalFiles,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search files and folders
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const searchQuery = {
      name: new RegExp(query, "i"),
      owner: req.user.id,
    };

    // Get total counts
    const totalFiles = await File.countDocuments(searchQuery);
    const totalFolders = await Folder.countDocuments(searchQuery);

    // Get paginated data
    const folders = await Folder.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const filesLimit = Math.max(0, limit - folders.length);
    const filesSkip =
      folders.length < limit ? 0 : Math.max(0, skip - totalFolders);

    const files = await File.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(filesSkip)
      .limit(filesLimit > 0 ? filesLimit : limit);

    res.json({
      files,
      folders,
      pagination: {
        page,
        limit,
        totalFolders,
        totalFiles,
        totalItems: totalFolders + totalFiles,
        hasMore:
          skip + folders.length + files.length < totalFolders + totalFiles,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Empty trash
router.delete("/trash/empty", async (req, res) => {
  try {
    const trashedFiles = await File.find({ trash: true, owner: req.user.id });
    const trashedFolders = await Folder.find({
      trash: true,
      owner: req.user.id,
    });

    // Delete all trashed files from storage (both direct files and files in folders)
    for (const file of trashedFiles) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // For each trashed folder, recursively delete all physical files within it
    for (const folder of trashedFolders) {
      await deletePhysicalFilesRecursively(folder._id, req.user.id);
    }

    // Delete all trashed items from database
    await File.deleteMany({ trash: true, owner: req.user.id });
    await Folder.deleteMany({ trash: true, owner: req.user.id });

    res.json({ message: "Trash emptied successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk share items
router.post("/bulk-share", async (req, res) => {
  try {
    const { email, items } = req.body; // items: [{id, type: 'file'|'folder'}]

    if (!email || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Email and items array required" });
    }

    // Find user by email
    const userToShareWith = await User.findOne({ email });
    if (!userToShareWith) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't share with yourself
    if (userToShareWith._id.toString() === req.user.id) {
      return res.status(400).json({ error: "Cannot share with yourself" });
    }

    const sharedItems = [];
    const errors = [];

    // Process each item
    for (const itemData of items) {
      try {
        const Model = itemData.type === 'file' ? File : Folder;
        const item = await Model.findById(itemData.id);

        if (!item) {
          errors.push({ id: itemData.id, error: "Item not found" });
          continue;
        }

        // Verify ownership
        if (item.owner.toString() !== req.user.id) {
          errors.push({ id: itemData.id, error: "Not authorized" });
          continue;
        }

        // Add user to shared array if not already shared
        if (!item.shared.includes(userToShareWith._id)) {
          item.shared.push(userToShareWith._id);
          await item.save();

          // If it's a folder, recursively share its contents
          if (itemData.type === 'folder') {
            await shareContentsRecursively(item._id, userToShareWith._id);
          }

          sharedItems.push({
            name: item.name,
            type: itemData.type
          });
        }
      } catch (error) {
        errors.push({ id: itemData.id, error: error.message });
      }
    }

    // Send bulk share email if any items were shared
    if (sharedItems.length > 0) {
      const owner = await User.findById(req.user.id);
      emailService
        .sendBulkShareEmail(userToShareWith, owner, sharedItems)
        .catch((err) => {
          console.error("Failed to send bulk share email:", err.message);
        });
    }

    res.json({
      message: `${sharedItems.length} items shared successfully`,
      sharedCount: sharedItems.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

