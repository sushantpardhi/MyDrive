const express = require("express");
const archiver = require("archiver");
const path = require("path");
const logger = require("../utils/logger");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const {
  shareContentsRecursively,
  unshareContentsRecursively,
  deleteFilesRecursively,
} = require("../utils/shareHelpers");
const emailService = require("../utils/emailService");
const ZipStreamService = require("../utils/zipStreamService");
const DownloadHelpers = require("../utils/downloadHelpers");

const router = express.Router();

// Mark a folder and all its descendants (folders + files) as trashed/restored
const markFolderTrashState = async (
  folderId,
  userId,
  trashState,
  trashedAt = null
) => {
  const timestamp = trashState ? trashedAt || new Date() : null;
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    // Update the current folder
    await Folder.updateOne(
      { _id: currentId, owner: userId },
      { trash: trashState, trashedAt: timestamp }
    );

    // Update files directly under this folder
    await File.updateMany(
      { parent: currentId, owner: userId },
      { trash: trashState, trashedAt: timestamp }
    );

    // Queue child folders for processing
    const childFolders = await Folder.find(
      { parent: currentId, owner: userId },
      "_id"
    );

    childFolders.forEach((child) => queue.push(child._id));
  }
};

// Verify folder download permissions and return metadata
router.get("/verify-download/:folderId", async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    if (!folder) {
      logger.warn(
        `Download verification failed - Folder not found: ${req.params.folderId} - User: ${req.user.id} - IP: ${req.ip}`
      );
      return res.status(404).json({ error: "Folder not found" });
    }

    // Count files recursively
    async function countFolderContents(folderId) {
      const files = await File.find({ parent: folderId, isDeleted: false });
      const subfolders = await Folder.find({ parent: folderId, isDeleted: false });
      
      let totalFiles = files.length;
      let totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      for (const subfolder of subfolders) {
        const subStats = await countFolderContents(subfolder._id);
        totalFiles += subStats.files;
        totalSize += subStats.size;
      }
      
      return { files: totalFiles, size: totalSize };
    }

    const stats = await countFolderContents(req.params.folderId);

    // Return folder metadata for frontend to initiate download
    res.json({
      id: folder._id,
      name: folder.name,
      totalFiles: stats.files,
      totalSize: stats.size,
      verified: true
    });
  } catch (error) {
    logger.logError(error, {
      operation: "verify-download",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.params.folderId,
    });
    res.status(500).json({ error: error.message });
  }
});

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

    // Build the query based on whether it's trash, shared, or regular drive
    let query;

    if (isTrash) {
      if (folderId !== null) {
        const trashedFolder = await Folder.findOne({
          _id: folderId,
          owner: req.user.id,
          trash: true,
        });

        if (!trashedFolder) {
          return res.status(404).json({ error: "Folder not found" });
        }

        // When inside Trash, scope results to the selected folder
        query = { parent: folderId, trash: true, owner: req.user.id };
      } else {
        // Root Trash view still returns all trashed items
        query = { trash: true, owner: req.user.id };
      }
    } else if (isSharedFolder) {
      query = {
        parent: folderId,
        trash: { $ne: true },
        // For shared folders, show items that are shared with the user
        shared: req.user.id,
      };
    } else {
      query = {
        parent: folderId,
        trash: { $ne: true },
        owner: req.user.id, // Only show items owned by the user in My Drive
      };
    }

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
  const startTime = Date.now();
  try {
    const { name, parent } = req.body;
    const folder = new Folder({
      name,
      parent: parent === "root" ? null : parent,
      owner: req.user.id,
    });
    await folder.save();

    logger.logFolderOperation("create", folder, req.user.id, {
      parent: parent,
      ip: req.ip,
      duration: Date.now() - startTime,
    });

    res.json(folder);
  } catch (error) {
    logger.logError(error, {
      operation: "create-folder",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.body.name,
    });
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
        trash: { $ne: true },
      });

      let fileCount = files.length;
      let totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

      // Get subfolders and count their contents
      const subfolders = await Folder.find({
        parent: parentId,
        trash: { $ne: true },
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
    logger.logError(error, "Error getting folder stats");
    res.status(500).json({ error: error.message });
  }
});

// Share folder - Updated to accept email instead of userId
router.post("/:id/share", async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { email } = req.body;

    const item = await Folder.findById(id);
    if (!item) {
      logger.warn(
        `Folder share failed - Folder not found: ${id} - User: ${req.user.id} - IP: ${req.ip}`
      );
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user is the owner
    if (item.owner.toString() !== req.user.id) {
      logger.warn(
        `Folder share failed - Not owner: ${id} - User: ${req.user.id} - IP: ${req.ip}`
      );
      return res
        .status(403)
        .json({ error: "You can only share items you own" });
    }

    // Find user by email
    const userToShareWith = await User.findOne({ email });
    if (!userToShareWith) {
      logger.warn(
        `Folder share failed - User not found: ${email} - Folder: ${id} - Owner: ${req.user.id}`
      );
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

      logger.logShare("folder-shared", item, req.user.id, {
        sharedWith: userToShareWith.email,
        resourceType: "folder",
        ip: req.ip,
      });

      // Send email notification to the user (non-blocking)
      const owner = await User.findById(req.user.id);
      emailService
        .sendFileSharedEmail(userToShareWith, owner, item.name, "folder")
        .catch((emailError) => {
          logger.warn(`Share notification email failed: ${emailError.message}`);
        });
    }

    logger.logPerformance("share-folder", Date.now() - startTime, {
      folderId: id,
    });

    res.json({
      message: "Folder shared successfully",
      item: await Folder.findById(id).populate("shared", "name email"),
    });
  } catch (error) {
    logger.logError(error, {
      operation: "share-folder",
      userId: req.user.id,
      ip: req.ip,
      additionalInfo: req.params.id,
    });
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
      // Move folder and all descendants to trash
      const trashedAt = new Date();
      await markFolderTrashState(id, req.user.id, true, trashedAt);
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

    // Restore folder and all descendants
    await markFolderTrashState(id, req.user.id, false, null);
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
  const startTime = Date.now();
  let archive = null;
  let filesProcessed = 0;

  try {
    const folderId = req.params.folderId;

    // Get the folder
    const folder = await Folder.findById(folderId);
    if (!folder) {
      logger.warn("Folder download failed - not found", {
        folderId,
        userId: req.user.id,
        ip: req.ip,
      });
      return res.status(404).json({ error: "Folder not found" });
    }

    // Check if user has access to the folder
    const hasAccess =
      folder.owner.toString() === req.user.id ||
      folder.shared.includes(req.user.id);

    if (!hasAccess) {
      logger.warn("Folder download failed - access denied", {
        folderId,
        userId: req.user.id,
        ip: req.ip,
      });
      return res.status(403).json({ error: "Access denied" });
    }

    logger.info("Folder download initiated", {
      folderId,
      folderName: folder.name,
      userId: req.user.id,
      ip: req.ip,
    });

    // Get all files in folder recursively using helper
    const resolvedFiles = await DownloadHelpers.getFolderFilesRecursive(
      folderId,
      req.user.id,
      "" // No base path - use folder name as root
    );

    // If folder is empty, return error
    if (resolvedFiles.length === 0) {
      logger.warn("Folder download failed - empty folder", {
        folderId,
        folderName: folder.name,
        userId: req.user.id,
      });
      return res.status(400).json({ error: "Folder is empty" });
    }

    // Calculate total size
    const totalSize = resolvedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    const totalFiles = resolvedFiles.length;

    logger.info("Starting folder ZIP stream", {
      folderId,
      folderName: folder.name,
      totalFiles,
      totalSize: DownloadHelpers.formatSize(totalSize),
      userId: req.user.id,
    });

    // Generate ZIP filename
    const zipFilename = `${folder.name}.zip`;

    // Add custom headers for progress tracking
    res.setHeader("X-Total-Files", totalFiles.toString());
    res.setHeader("X-Total-Size", totalSize.toString());

    // Create ZIP stream using service
    archive = ZipStreamService.createZipStream(res, zipFilename, {
      compressionLevel: 6,
      comment: `MyDrive folder: ${folder.name} - ${totalFiles} file(s)`,
    });

    // Handle client disconnect
    ZipStreamService.handleClientDisconnect(req, archive, () => {
      logger.warn("Client disconnected during folder download", {
        folderId,
        folderName: folder.name,
        filesProcessed,
        totalFiles,
        userId: req.user.id,
      });
    });

    // Add all files to ZIP
    for (const fileEntry of resolvedFiles) {
      try {
        // Use folder name as root in zip path
        const zipPath = `${folder.name}/${fileEntry.zipPath}`;
        
        await ZipStreamService.addFileToZip(
          archive,
          fileEntry.filePath,
          zipPath
        );
        filesProcessed++;
      } catch (error) {
        logger.error("Error adding file to folder ZIP", {
          folderId,
          fileId: fileEntry.fileDoc._id,
          fileName: fileEntry.fileDoc.name,
          error: error.message,
          userId: req.user.id,
        });
        // Continue with other files
      }
    }

    // Finalize ZIP
    await ZipStreamService.finalizeZip(archive);

    const duration = Date.now() - startTime;

    logger.info("Folder download completed", {
      folderId,
      folderName: folder.name,
      filesProcessed,
      totalFiles,
      totalSize: DownloadHelpers.formatSize(totalSize),
      duration: `${(duration / 1000).toFixed(2)}s`,
      avgSpeed: DownloadHelpers.formatSize(totalSize / (duration / 1000)) + "/s",
      userId: req.user.id,
      ip: req.ip,
    });

    // Note: Response is already sent via stream
  } catch (error) {
    logger.error("Folder download failed", {
      folderId: req.params.folderId,
      filesProcessed,
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      ip: req.ip,
    });

    // Abort archive if it exists
    if (archive && !archive.destroyed) {
      archive.abort();
      archive.destroy();
    }

    // Only send error response if headers not sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Folder download failed",
        message: error.message
      });
    }
  }
});

module.exports = router;
