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
const { requireNonTemporaryGuestFor } = require("../middleware/guestAuth");

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
      allSharedFolders.map((f) => f._id.toString()),
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

// Search files and folders with advanced filters
router.get("/search", async (req, res) => {
  try {
    const {
      query,
      fileTypes,
      sizeMin,
      sizeMax,
      dateStart,
      dateEnd,
      sortBy = "createdAt",
      sortOrder = "desc",
      folderId,
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Import search helpers
    const {
      buildSearchQuery,
      buildSortOptions,
      addSearchHighlights,
    } = require("../utils/searchHelpers");

    // Build advanced search query
    const searchParams = {
      query,
      userId: req.user.id,
      fileTypes: fileTypes ? fileTypes.split(",") : [],
      sizeRange: {},
      dateRange: {},
      trash: false,
      folderId: folderId && folderId !== "root" ? folderId : null,
    };

    if (sizeMin) searchParams.sizeRange.min = parseInt(sizeMin);
    if (sizeMax) searchParams.sizeRange.max = parseInt(sizeMax);
    if (dateStart) searchParams.dateRange.start = dateStart;
    if (dateEnd) searchParams.dateRange.end = dateEnd;

    // Build query for files and folders
    let fileSearchQuery;
    try {
      fileSearchQuery = buildSearchQuery(searchParams);
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Invalid search query: " + error.message });
    }

    const folderSearchQuery = {
      owner: req.user.id,
      trash: false,
    };

    // Add partial word search for folders
    try {
      if (query && query.trim()) {
        const words = query.trim().split(/\s+/);
        if (words.length === 1) {
          const escapedWord = words[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          folderSearchQuery.name = new RegExp(escapedWord, "i");
        } else {
          folderSearchQuery.$or = words.map((word) => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return { name: new RegExp(escapedWord, "i") };
          });
        }
      }
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Invalid search query: " + error.message });
    }

    // Add folder filter if specified
    if (folderId && folderId !== "root") {
      folderSearchQuery.parent = folderId;
    }

    // Build sort options
    const hasTextSearch = !!(query && query.trim());
    const sortOptions = buildSortOptions(sortBy, sortOrder, hasTextSearch);

    // Get total counts
    const totalFiles = await File.countDocuments(fileSearchQuery);
    const totalFolders = await Folder.countDocuments(folderSearchQuery);

    // Get paginated data
    let folders = await Folder.find(folderSearchQuery)
      .populate("owner", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const filesLimit = Math.max(0, limit - folders.length);
    const filesSkip =
      folders.length < limit ? 0 : Math.max(0, skip - totalFolders);

    let files = await File.find(fileSearchQuery)
      .populate("owner", "name email")
      .sort(sortOptions)
      .skip(filesSkip)
      .limit(filesLimit > 0 ? filesLimit : limit);

    // Add search highlights and relevance scores
    if (query && query.trim()) {
      folders = addSearchHighlights(folders, query);
      files = addSearchHighlights(files, query);
    }

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
      filters: {
        fileTypes: searchParams.fileTypes,
        sizeRange: searchParams.sizeRange,
        dateRange: searchParams.dateRange,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    logger.logError(error, "Search error");
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

    // Calculate total size of trashed files for storage update
    let totalSize = 0;

    // Delete all trashed files from storage (both direct files and files in folders)
    for (const file of trashedFiles) {
      totalSize += file.size || 0;
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // For each trashed folder, recursively delete all physical files within it
    // and calculate their total size
    for (const folder of trashedFolders) {
      const folderFiles = await File.find({
        parent: folder._id,
        owner: req.user.id,
      });
      for (const file of folderFiles) {
        totalSize += file.size || 0;
      }
      await deletePhysicalFilesRecursively(folder._id, req.user.id);
    }

    // Update user's storage usage (subtract total size)
    if (totalSize > 0) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { storageUsed: -totalSize },
      });
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
router.post(
  "/bulk-share",
  requireNonTemporaryGuestFor("Sharing files"),
  async (req, res) => {
    try {
      const { email, items } = req.body; // items: [{id, type: 'file'|'folder'}]

      if (!email || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ error: "Email and items array required" });
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
          const Model = itemData.type === "file" ? File : Folder;
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
            if (itemData.type === "folder") {
              await shareContentsRecursively(item._id, userToShareWith._id);
            }

            sharedItems.push({
              name: item.name,
              type: itemData.type,
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
          .catch(() => {
            // Email send failure is non-critical
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
  },
);

module.exports = router;
