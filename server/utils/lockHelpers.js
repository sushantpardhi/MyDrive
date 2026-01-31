const Folder = require("../models/Folder");
const File = require("../models/File");

/**
 * Check if an item or any of its ancestors are locked
 * @param {Object} item - The file or folder object
 * @returns {Promise<{isLocked: boolean, lockedItem: Object|null}>}
 */
const checkLockStatus = async (item) => {
  // 1. Check the item itself
  if (item.isLocked) {
    return { isLocked: true, lockedItem: item };
  }

  // 2. Check ancestors
  let currentParentId = item.parent;

  // Handle case where parent might be "root" string or null
  if (currentParentId === "root") currentParentId = null;

  while (currentParentId) {
    // If parent is an object (populated), use ._id
    const parentId = currentParentId._id || currentParentId;

    const parentFolder = await Folder.findById(parentId);
    if (!parentFolder) break;

    if (parentFolder.isLocked) {
      return { isLocked: true, lockedItem: parentFolder };
    }

    currentParentId = parentFolder.parent;
    if (currentParentId === "root") currentParentId = null;
  }

  return { isLocked: false, lockedItem: null };
};

/**
 * Recursively check if a folder contains any locked items (files or subfolders)
 * @param {string} folderId - The ID of the folder to check
 * @returns {Promise<boolean>} - True if any descendant is locked
 */
const hasLockedDescendants = async (folderId) => {
  // 1. Check direct files
  const lockedFiles = await File.findOne({
    parent: folderId,
    isLocked: true,
    trash: { $ne: true },
  });
  if (lockedFiles) return true;

  // 2. Check direct subfolders
  const subfolders = await Folder.find({
    parent: folderId,
    trash: { $ne: true },
  });

  for (const folder of subfolders) {
    // Check if the subfolder itself is locked
    if (folder.isLocked) return true;

    // Recursively check its contents
    const hasLockedChildren = await hasLockedDescendants(folder._id);
    if (hasLockedChildren) return true;
  }

  return false;
};

module.exports = { checkLockStatus, hasLockedDescendants };
