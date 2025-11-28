const File = require("../models/File");
const Folder = require("../models/Folder");
const fs = require("fs");

// Helper function to recursively delete physical files in a folder and its subfolders
// Only deletes files and folders owned by the specified userId for security
async function deleteFilesRecursively(folderId, ownerId) {
  try {
    // Get all files in this folder that are owned by the user
    const files = await File.find({ parent: folderId, owner: ownerId });

    // Delete physical files from uploads folder
    for (const file of files) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // Delete files from database (only user's own files)
    await File.deleteMany({ parent: folderId, owner: ownerId });

    // Get all subfolders owned by the user and recursively delete their contents
    const subfolders = await Folder.find({ parent: folderId, owner: ownerId });
    for (const subfolder of subfolders) {
      await deleteFilesRecursively(subfolder._id, ownerId);
    }

    // Delete the subfolders from database (only user's own folders)
    await Folder.deleteMany({ parent: folderId, owner: ownerId });
  } catch (error) {
    console.error("Error deleting files recursively:", error);
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
    console.error("Error deleting physical files recursively:", error);
    throw error;
  }
}

// Helper function to recursively share folder contents
async function shareContentsRecursively(folderId, userId) {
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
      }
    }

    for (const subfolder of subfolders) {
      if (!subfolder.shared.includes(userId)) {
        subfolder.shared.push(userId);
        await subfolder.save();
      }
      await shareContentsRecursively(subfolder._id, userId);
    }
  } catch (error) {
    console.error("Error sharing folder contents recursively:", error);
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
    console.error("Error unsharing folder contents recursively:", error);
    throw error;
  }
}

module.exports = {
  shareContentsRecursively,
  unshareContentsRecursively,
  deleteFilesRecursively,
  deletePhysicalFilesRecursively,
};
