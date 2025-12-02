const File = require("../models/File");
const Folder = require("../models/Folder");
const fs = require("fs");
const logger = require("./logger");

// Helper function to recursively delete physical files in a folder and its subfolders
// Only deletes files and folders owned by the specified userId for security
async function deleteFilesRecursively(folderId, ownerId) {
  const startTime = Date.now();
  let filesDeleted = 0;
  let foldersDeleted = 0;

  try {
    logger.debug(
      `Starting recursive deletion - Folder: ${folderId} - Owner: ${ownerId}`
    );

    // Get all files in this folder that are owned by the user
    const files = await File.find({ parent: folderId, owner: ownerId });

    // Delete physical files from uploads folder
    for (const file of files) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        filesDeleted++;
      }
    }

    // Delete files from database (only user's own files)
    await File.deleteMany({ parent: folderId, owner: ownerId });

    // Get all subfolders owned by the user and recursively delete their contents
    const subfolders = await Folder.find({ parent: folderId, owner: ownerId });
    for (const subfolder of subfolders) {
      const result = await deleteFilesRecursively(subfolder._id, ownerId);
      filesDeleted += result.filesDeleted;
      foldersDeleted += result.foldersDeleted;
    }

    // Delete the subfolders from database (only user's own folders)
    const deletedFolders = await Folder.deleteMany({
      parent: folderId,
      owner: ownerId,
    });
    foldersDeleted += deletedFolders.deletedCount;

    const duration = Date.now() - startTime;
    logger.logCleanup(`recursive-delete-folder-${folderId}`, {
      itemsRemoved: filesDeleted + foldersDeleted,
      duration,
    });

    return { filesDeleted, foldersDeleted };
  } catch (error) {
    logger.logError(error, {
      operation: "deleteFilesRecursively",
      additionalInfo: `Folder: ${folderId}, Owner: ${ownerId}`,
    });
    throw error;
  }
}

// Helper function to recursively delete only physical files (not from database) - used for trash cleanup
// Only deletes files owned by the specified userId for security
async function deletePhysicalFilesRecursively(folderId, ownerId) {
  try {
    // Get all files in this folder that are owned by the user
    const files = await File.find({ parent: folderId, owner: ownerId });

    // Delete only physical files from uploads folder
    for (const file of files) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // Get all subfolders owned by the user and recursively delete their physical files
    const subfolders = await Folder.find({ parent: folderId, owner: ownerId });
    for (const subfolder of subfolders) {
      await deletePhysicalFilesRecursively(subfolder._id, ownerId);
    }
  } catch (error) {
    logger.logError(error, "Error deleting physical files recursively");
    throw error;
  }
}

// Helper function to recursively share folder contents
async function shareContentsRecursively(folderId, userId) {
  const startTime = Date.now();
  let filesShared = 0;
  let foldersShared = 0;

  try {
    const subfolders = await Folder.find({
      parent: folderId,
      trash: { $ne: true },
    });

    const files = await File.find({
      parent: folderId,
      trash: { $ne: true },
    });

    for (const file of files) {
      if (!file.shared.includes(userId)) {
        file.shared.push(userId);
        await file.save();
        filesShared++;
      }
    }

    for (const subfolder of subfolders) {
      if (!subfolder.shared.includes(userId)) {
        subfolder.shared.push(userId);
        await subfolder.save();
        foldersShared++;
      }
      const result = await shareContentsRecursively(subfolder._id, userId);
      filesShared += result.filesShared;
      foldersShared += result.foldersShared;
    }

    const duration = Date.now() - startTime;
    logger.logShare("recursive-share", { folderId }, userId, {
      resourceType: "folder-contents",
      sharedWith: userId,
      additionalInfo: `Files: ${filesShared}, Folders: ${foldersShared}, Duration: ${duration}ms`,
    });

    return { filesShared, foldersShared };
  } catch (error) {
    logger.logError(error, {
      operation: "shareContentsRecursively",
      additionalInfo: `Folder: ${folderId}, User: ${userId}`,
    });
    throw error;
  }
}

// Helper function to recursively unshare folder contents
async function unshareContentsRecursively(folderId, userId) {
  try {
    const subfolders = await Folder.find({
      parent: folderId,
      trash: { $ne: true },
    });

    const files = await File.find({
      parent: folderId,
      trash: { $ne: true },
    });

    for (const file of files) {
      file.shared = file.shared.filter(
        (sharedUserId) => sharedUserId.toString() !== userId.toString()
      );
      await file.save();
    }

    for (const subfolder of subfolders) {
      subfolder.shared = subfolder.shared.filter(
        (sharedUserId) => sharedUserId.toString() !== userId.toString()
      );
      await subfolder.save();
      await unshareContentsRecursively(subfolder._id, userId);
    }
  } catch (error) {
    logger.logError(error, "Error unsharing folder contents recursively");
    throw error;
  }
}

module.exports = {
  shareContentsRecursively,
  unshareContentsRecursively,
  deleteFilesRecursively,
  deletePhysicalFilesRecursively,
};
