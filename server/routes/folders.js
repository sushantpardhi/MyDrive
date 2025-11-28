const express = require("express");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const {
  shareContentsRecursively,
  unshareContentsRecursively,
  deleteFilesRecursively,
} = require("../utils/shareHelpers");

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

    // Check if user has access to the parent folder (if not root)
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
    }

    const query = isTrash
      ? { trash: true, owner: req.user.id }
      : {
          parent: folderId,
          trash: { $ne: true },
          $or: [
            { owner: req.user.id }, // Items owned by the user
            { shared: req.user.id }, // Items shared with the user
          ],
        };

    // Get total counts
    const totalFolders = await Folder.countDocuments(query);
    const totalFiles = await File.countDocuments(query);

    // Get paginated data - folders first, then files
    let folders = [];
    let files = [];

    if (skip < totalFolders) {
      // We're still in the folders range
      folders = await Folder.find(query)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // If we have room for files after folders
      const remainingLimit = limit - folders.length;
      if (remainingLimit > 0) {
        files = await File.find(query)
          .populate("owner", "name email")
          .sort({ createdAt: -1 })
          .limit(remainingLimit);
      }
    } else {
      // We've passed all folders, only get files
      const fileSkip = skip - totalFolders;
      files = await File.find(query)
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

module.exports = router;
