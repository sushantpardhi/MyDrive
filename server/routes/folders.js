const express = require("express");
const archiver = require("archiver");
const path = require("path");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const {
  shareContentsRecursively,
  unshareContentsRecursively,
  deleteFilesRecursively,
} = require("../utils/shareHelpers");
const emailService = require("../utils/emailService");

const router = express.Router();

// Get folder contents or trash contents
router.get("/:folderId", async (req, res) => {
  try {
    const folderId =
      req.params.folderId === "root" ? null : req.params.folderId;
    const isTrash = req.query.trash === "true";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";

    // Check if user has access to the parent folder (if not root)
    let isSharedFolder = false;
    if (folderId !== null && !isTrash) {
      const parentFolder = await Folder.findById(folderId);
      if (!parentFolder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // Check if user owns the folder or it's shared with them
      const hasAccess =
        parentFolder.owner.toString() === req.user.id ||
        parentFolder.shared.includes(req.user.id);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Track if this is a shared folder to adjust query
      isSharedFolder = parentFolder.shared.includes(req.user.id);
    }

    // Build the query based on whether it's a shared folder or not
    const query = isTrash
      ? { trash: true, owner: req.user.id }
      : isSharedFolder
      ? {
          parent: folderId,
          trash: { $ne: true },
          // For shared folders, show items that are shared with the user
          shared: req.user.id,
        }
      : {
          parent: folderId,
          trash: { $ne: true },
          owner: req.user.id, // Only show items owned by the user in My Drive
        };

    // Get total counts
    const totalFolders = await Folder.countDocuments(query);
    const totalFiles = await File.countDocuments(query);

    // Build sort options
    const order = sortOrder === "asc" ? 1 : -1;
    let sortOptions = {};
    switch (sortBy) {
      case "name":
        sortOptions.name = order;
        break;
      case "size":
        sortOptions.size = order;
        break;
      case "updatedAt":
        sortOptions.updatedAt = order;
        break;
      case "createdAt":
      default:
        sortOptions.createdAt = order;
        break;
    }

    // Get paginated data - folders first, then files
    let folders = [];
    let files = [];

    if (skip < totalFolders) {
      // We're still in the folders range
      folders = await Folder.find(query)
        .populate("owner", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      // If we have room for files after folders
      const remainingLimit = limit - folders.length;
      if (remainingLimit > 0) {
        files = await File.find(query)
          .populate("owner", "name email")
          .sort(sortOptions)
          .limit(remainingLimit);
      }
    } else {
      // We've passed all folders, only get files
      const fileSkip = skip - totalFolders;
      files = await File.find(query)
        .populate("owner", "name email")
        .sort(sortOptions)
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

// Create new folder
router.post("/", async (req, res) => {
  try {
    const { name, parent } = req.body;
    const folder = new Folder({
      name,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
    });
    await folder.save();
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get folder details with populated shared users
router.get("/:folderId/details", async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId)
      .populate("shared", "name email")
      .populate("owner", "name email");
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get folder statistics (file count and total size)
router.get("/:folderId/stats", async (req, res) => {
  try {
    const folderId = req.params.folderId;
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user has access
    const hasAccess =
      folder.owner.toString() === req.user.id ||
      folder.shared.includes(req.user.id);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Count files and calculate total size recursively
    const countRecursive = async (parentId) => {
      // Get direct files in this folder
      const files = await File.find({ 
        parent: parentId, 
        trash: { $ne: true } 
      });
      
      let fileCount = files.length;
      let totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

      // Get subfolders and count their contents
      const subfolders = await Folder.find({ 
        parent: parentId, 
        trash: { $ne: true } 
      });
      
      for (const subfolder of subfolders) {
        const subStats = await countRecursive(subfolder._id);
        fileCount += subStats.fileCount;
        totalSize += subStats.totalSize;
      }

      return { fileCount, totalSize };
    };

    const stats = await countRecursive(folderId);
    res.json(stats);
  } catch (error) {
    console.error("Error getting folder stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Share folder - Updated to accept email instead of userId
router.post("/:id/share", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only share items you own" });
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

    // Add user to shared array if not already shared
    if (!item.shared.includes(userToShareWith._id)) {
      item.shared.push(userToShareWith._id);
      await item.save();

      // Recursively share all contents of this folder
      await shareContentsRecursively(item._id, userToShareWith._id);

      // Send email notification to the user (non-blocking)
      const owner = await User.findById(req.user.id);
      emailService
        .sendFileSharedEmail(userToShareWith, owner, item.name, "folder")
        .catch((err) => {
          console.error("Failed to send folder shared email:", err.message);
        });
    }

    res.json({
      message: "Folder shared successfully",
      item: await Folder.findById(id).populate("shared", "name email"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unshare folder - Remove user from shared list
router.delete("/:id/share/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only unshare items you own" });
    }

    // Remove user from shared array
    item.shared = item.shared.filter(
      (sharedUserId) => sharedUserId.toString() !== userId
    );
    await item.save();

    // Recursively unshare all contents of this folder
    await unshareContentsRecursively(item._id, userId);

    res.json({
      message: "User removed from shared list",
      item: await Folder.findById(id).populate("shared", "name email"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move folder to trash or permanently delete
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === "true";

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete items you own" });
    }

    if (permanent) {
      // Permanently delete - first delete all files recursively
      await deleteFilesRecursively(id, req.user.id);
      // Then delete the folder itself
      await Folder.findByIdAndDelete(id);
      res.json({ message: "Permanently deleted" });
    } else {
      // Move to trash
      item.trash = true;
      item.trashedAt = new Date();
      await item.save();
      res.json({ message: "Moved to trash" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore folder from trash
router.post("/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only restore items you own" });
    }

    item.trash = false;
    item.trashedAt = null;
    await item.save();
    res.json({ message: "Restored successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename folder
router.put("/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only rename items you own" });
    }

    // Check if folder with same name exists in the same parent
    const existingFolder = await Folder.findOne({
      name: name.trim(),
      parent: item.parent,
      owner: req.user.id,
      _id: { $ne: id },
      trash: { $ne: true },
    });

    if (existingFolder) {
      return res
        .status(400)
        .json({ error: "A folder with this name already exists" });
    }

    item.name = name.trim();
    await item.save();
    res.json({ message: "Folder renamed successfully", item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy folder (recursive)
router.post("/:id/copy", async (req, res) => {
  try {
    const { id } = req.params;
    const { parent, name } = req.body;

    const sourceFolder = await Folder.findById(id);
    if (!sourceFolder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user has access to the source folder
    const hasAccess =
      sourceFolder.owner.toString() === req.user.id ||
      sourceFolder.shared.includes(req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // If parent is specified, check if user has access to target folder
    if (parent && parent !== "root") {
      const targetFolder = await Folder.findById(parent);
      if (!targetFolder) {
        return res.status(404).json({ error: "Target folder not found" });
      }

      const hasTargetAccess =
        targetFolder.owner.toString() === req.user.id ||
        targetFolder.shared.includes(req.user.id);
      if (!hasTargetAccess) {
        return res
          .status(403)
          .json({ error: "Access denied to target folder" });
      }
    }

    // Prevent copying folder into itself or its descendants
    if (parent !== "root" && parent === id) {
      return res.status(400).json({ error: "Cannot copy folder into itself" });
    }

    // Check if copying into a descendant folder
    const isDescendant = async (folderId, potentialAncestorId) => {
      if (!folderId || folderId === "root") return false;

      const folder = await Folder.findById(folderId);
      if (!folder) return false;

      if (folder.parent && folder.parent.toString() === potentialAncestorId) {
        return true;
      }

      return folder.parent
        ? await isDescendant(folder.parent, potentialAncestorId)
        : false;
    };

    if (parent !== "root" && (await isDescendant(parent, id))) {
      return res
        .status(400)
        .json({ error: "Cannot copy folder into its descendant" });
    }

    // Generate unique name if not provided
    let copyName = name || `Copy of ${sourceFolder.name}`;
    let counter = 1;

    // Check for name conflicts and generate unique name
    while (
      await Folder.findOne({
        name: copyName,
        parent: parent === "root" ? null : parent,
        owner: req.user.id,
        trash: { $ne: true },
      })
    ) {
      copyName = name
        ? `${name} (${counter})`
        : `Copy of ${sourceFolder.name} (${counter})`;
      counter++;
    }

    // Recursive function to copy folder and its contents
    const copyFolderRecursive = async (
      sourceFolderId,
      targetParent,
      newName = null
    ) => {
      const sourceFolder = await Folder.findById(sourceFolderId);
      if (!sourceFolder) return null;

      // Create new folder
      const newFolder = new Folder({
        name: newName || sourceFolder.name,
        parent: targetParent === "root" ? null : targetParent,
        owner: req.user.id,
      });
      await newFolder.save();

      // Copy all files in this folder
      const files = await File.find({
        parent: sourceFolderId,
        trash: { $ne: true },
      });

      for (const file of files) {
        const fs = require("fs");
        const path = require("path");
        const { v4: uuidv4 } = require("uuid");
        const {
          getUserFilePath,
          ensureUserDir,
        } = require("../utils/fileHelpers");

        // Copy physical file
        const sourcePath = file.path;
        const newFileName = `${uuidv4()}-${file.name}`;
        const newPath = getUserFilePath(req.user.id, newFileName);

        // Ensure user directory exists
        ensureUserDir(req.user.id);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, newPath);
        }

        // Create new file record
        const newFile = new File({
          name: file.name,
          type: file.type,
          path: newPath,
          size: file.size,
          parent: newFolder._id,
          owner: req.user.id,
        });
        await newFile.save();
      }

      // Copy all subfolders recursively
      const subfolders = await Folder.find({
        parent: sourceFolderId,
        trash: { $ne: true },
      });

      for (const subfolder of subfolders) {
        await copyFolderRecursive(subfolder._id, newFolder._id);
      }

      return newFolder;
    };

    const newFolder = await copyFolderRecursive(id, parent, copyName);
    res.json({ message: "Folder copied successfully", item: newFolder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move folder
router.put("/:id/move", async (req, res) => {
  try {
    const { id } = req.params;
    const { parent } = req.body;

    const item = await Folder.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "You can only move items you own" });
    }

    // If moving to a specific folder, validate it exists and user has access
    if (parent && parent !== "root") {
      const targetFolder = await Folder.findById(parent);
      if (!targetFolder) {
        return res.status(404).json({ error: "Target folder not found" });
      }

      // Check if user owns the target folder
      if (targetFolder.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Access denied to target folder" });
      }
    }

    // Prevent moving folder into itself or its descendants
    if (parent !== "root" && parent === id) {
      return res.status(400).json({ error: "Cannot move folder into itself" });
    }

    // Check if moving into a descendant folder
    const isDescendant = async (folderId, potentialAncestorId) => {
      if (!folderId || folderId === "root") return false;

      const folder = await Folder.findById(folderId);
      if (!folder) return false;

      if (folder.parent && folder.parent.toString() === potentialAncestorId) {
        return true;
      }

      return folder.parent
        ? await isDescendant(folder.parent, potentialAncestorId)
        : false;
    };

    if (parent !== "root" && (await isDescendant(parent, id))) {
      return res
        .status(400)
        .json({ error: "Cannot move folder into its descendant" });
    }

    // Check if folder with same name exists in target location
    const existingFolder = await Folder.findOne({
      name: item.name,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
      _id: { $ne: id },
      trash: { $ne: true },
    });

    if (existingFolder) {
      return res.status(400).json({
        error: "A folder with this name already exists in the target location",
      });
    }

    item.parent = parent === "root" ? null : parent;
    await item.save();
    res.json({ message: "Folder moved successfully", item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download folder as ZIP
router.get("/download/:folderId", async (req, res) => {
  try {
    const folderId = req.params.folderId;

    // Get the folder
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user has access to the folder
    const hasAccess =
      folder.owner.toString() === req.user.id ||
      folder.shared.includes(req.user.id);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Helper function to recursively collect all files in a folder
    const collectFilesRecursively = async (folderId) => {
      const files = [];
      const folders = [];

      // Get all files in current folder
      const currentFiles = await File.find({
        parent: folderId,
        trash: false,
      });
      files.push(...currentFiles);

      // Get all subfolders
      const subfolders = await Folder.find({
        parent: folderId,
        trash: false,
      });
      folders.push(...subfolders);

      // Recursively collect files from subfolders
      for (const subfolder of subfolders) {
        const subfolderData = await collectFilesRecursively(subfolder._id);
        files.push(...subfolderData.files);
        folders.push(...subfolderData.folders);
      }

      return { files, folders };
    };

    // Collect all files recursively
    const { files } = await collectFilesRecursively(folderId);

    // If folder is empty, return error
    if (files.length === 0) {
      return res.status(400).json({ error: "Folder is empty" });
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Set response headers for download
    const zipFilename = `${folder.name}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(zipFilename)}"`
    );
    // Add custom header for total files count and size
    res.setHeader("X-Total-Files", files.length.toString());
    res.setHeader("X-Total-Size", totalSize.toString());

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 6 }, // Compression level
    });

    let processedFiles = 0;
    let processedBytes = 0;

    // Track progress
    archive.on("entry", (entry) => {
      processedFiles++;
      // Note: This fires when a file is added to the archive
      console.log(`Zipping progress: ${processedFiles}/${files.length} files`);
    });

    archive.on("progress", (progress) => {
      processedBytes = progress.fs.processedBytes;
      console.log(
        `Archive progress: ${processedBytes} / ${progress.fs.totalBytes} bytes`
      );
    });

    // Handle archiver warnings
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Archiver warning:", err);
      } else {
        throw err;
      }
    });

    // Handle archiver errors
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error creating ZIP file" });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Helper function to get relative path for a file
    const getRelativePath = async (file) => {
      const pathSegments = [];
      let currentParent = file.parent;

      // Build path from file's parent up to the root folder
      while (
        currentParent &&
        currentParent.toString() !== folderId.toString()
      ) {
        const parentFolder = await Folder.findById(currentParent);
        if (parentFolder) {
          pathSegments.unshift(parentFolder.name);
          currentParent = parentFolder.parent;
        } else {
          break;
        }
      }

      return pathSegments.join("/");
    };

    // Add files to archive
    for (const file of files) {
      try {
        const relativePath = await getRelativePath(file);
        const filePathInZip = relativePath
          ? `${relativePath}/${file.name}`
          : file.name;

        archive.file(file.path, { name: filePathInZip });
      } catch (err) {
        console.error(`Error adding file ${file.name} to archive:`, err);
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("Error downloading folder:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
