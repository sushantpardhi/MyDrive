const express = require("express");
const User = require("../models/User");
const File = require("../models/File");
const Folder = require("../models/Folder");
const UploadSession = require("../models/UploadSession");
const logger = require("../utils/logger");
const { requireRole } = require("../middleware/roleAuth");
const { formatBytes } = require("../utils/storageHelpers");

const router = express.Router();

// All routes require admin role
router.use(requireRole("admin"));

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const { startDate, endDate, role } = req.query;

    logger.info("Admin fetching system stats", {
      adminId: req.user.id,
      filters: { startDate, endDate, role },
    });

    // Helper to build date query
    const getDateQuery = (field = "createdAt") => {
      const query = { trash: false };

      if (startDate || endDate) {
        query[field] = {};
        if (startDate) query[field].$gte = new Date(startDate);
        if (endDate) query[field].$lte = new Date(endDate);
      }
      return query;
    };

    // Helper to build date query extended (for things that might not have trash field or different structure)
    const getDateRangeQuery = (field = "createdAt") => {
      const query = {};
      if (startDate || endDate) {
        query[field] = {};
        if (startDate) query[field].$gte = new Date(startDate);
        if (endDate) query[field].$lte = new Date(endDate);
      }
      return query;
    };

    // 1. User Statistics
    // Base user query
    const userQuery = {};
    if (startDate || endDate) {
      userQuery.createdAt = {};
      if (startDate) userQuery.createdAt.$gte = new Date(startDate);
      if (endDate) userQuery.createdAt.$lte = new Date(endDate);
    }

    // Total users (filtered by date if provided)
    const totalUsers = await User.countDocuments(userQuery);

    // Users by role (filtered by date if provided)
    const usersByRole = await User.aggregate([
      { $match: userQuery },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // New users this week (or in range if range provided)
    let newUsersCount;
    if (startDate || endDate) {
      // If range is provided, "new users" is just the total in that range
      newUsersCount = totalUsers;
    } else {
      // Default behavior: last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      newUsersCount = await User.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      });
    }

    // 2. File Statistics
    // Base file query with date filters
    const fileQuery = getDateQuery("createdAt");

    // Apply role filter if selected (requires looking up users first)
    if (role && role !== "all") {
      const usersWithRole = await User.find({ role }).select("_id");
      const userIds = usersWithRole.map((u) => u._id);
      fileQuery.owner = { $in: userIds };
    }

    const totalFiles = await File.countDocuments(fileQuery);

    // Trash count (uses specific trash query)
    const trashQuery = { trash: true };
    if (startDate || endDate) {
      trashQuery.createdAt = {}; // Use deletedAt if available, but for now createdAt
      if (startDate) trashQuery.createdAt.$gte = new Date(startDate);
      if (endDate) trashQuery.createdAt.$lte = new Date(endDate);
    }
    const totalFilesInTrash = await File.countDocuments(trashQuery);

    // Folders count
    const folderQuery = getDateQuery("createdAt");
    if (role && role !== "all") {
      // Re-use owner logic if needed, but for now assume consistency with fileQuery
      if (fileQuery.owner) folderQuery.owner = fileQuery.owner;
    }
    const totalFolders = await Folder.countDocuments(folderQuery);

    // 3. Storage Statistics
    const storageStats = await File.aggregate([
      { $match: fileQuery },
      {
        $group: {
          _id: null,
          totalStorage: { $sum: "$size" },
          avgFileSize: { $avg: "$size" },
          maxFileSize: { $max: "$size" },
          minFileSize: { $min: "$size" },
        },
      },
    ]);

    // 4. User Storage Statistics
    // This is aggregate of current state, hard to filter by date unless we track history.
    // We will filter by role though.
    const userStorageQuery = {};
    if (role && role !== "all") {
      userStorageQuery.role = role;
    }
    // Note: user storage stats usually reflect current usage, not historical.
    // Date filter on user creation could apply, but might be confusing.
    // We'll apply role filter only here.

    const userStorageStats = await User.aggregate([
      { $match: userStorageQuery },
      {
        $group: {
          _id: null,
          totalUsed: { $sum: "$storageUsed" },
          avgUsed: { $avg: "$storageUsed" },
          maxUsed: { $max: "$storageUsed" },
        },
      },
    ]);

    // 5. File Type Distribution
    const fileTypeDistribution = await File.aggregate([
      { $match: fileQuery },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalSize: { $sum: "$size" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // 6. Active Upload Sessions (Real-time, no date filter usually)
    const activeUploadSessions = await UploadSession.countDocuments({
      expiresAt: { $gt: new Date() },
    });

    // 7. Storage Trend
    // If date range provided, use it. Else default to 30 days.
    let trendStart, trendEnd;

    if (startDate) {
      trendStart = new Date(startDate);
    } else {
      trendStart = new Date();
      trendStart.setDate(trendStart.getDate() - 30);
    }

    if (endDate) {
      trendEnd = new Date(endDate);
    }

    const trendQuery = {
      trash: false,
      createdAt: { $gte: trendStart },
    };
    if (trendEnd) {
      trendQuery.createdAt.$lte = trendEnd;
    }
    // Apply role filter to trend
    if (role && role !== "all" && fileQuery.owner) {
      trendQuery.owner = fileQuery.owner;
    }

    const storageTrend = await File.aggregate([
      { $match: trendQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalSize: { $sum: "$size" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 8. Top Storage Users
    // Apply role filter
    const topUserQuery = {};
    if (role && role !== "all") {
      topUserQuery.role = role;
    }

    const topStorageUsers = await User.find(topUserQuery)
      .select("name email storageUsed")
      .sort({ storageUsed: -1 })
      .limit(5)
      .lean();

    // Get file count for top users (respecting date filter for counts?)
    // Usually "Top Storage Users" implies current usage.
    // Date filter on file counts might be interesting but inconsistent with "Storage Used" (which is total).
    // keeping it simple: Total files for these users.
    const topUserIds = topStorageUsers.map((u) => u._id);
    const topUserFileCounts = await File.aggregate([
      { $match: { owner: { $in: topUserIds }, trash: false } },
      { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]);

    const topUserFileCountMap = topUserFileCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const topStorageUsersWithCounts = topStorageUsers.map((user) => ({
      ...user,
      fileCount: topUserFileCountMap[user._id.toString()] || 0,
    }));

    // 9. File Size Distribution
    const fileSizeDistribution = await File.aggregate([
      { $match: fileQuery },
      {
        $bucket: {
          groupBy: "$size",
          boundaries: [
            0,
            1024 * 1024, // 1MB
            10 * 1024 * 1024, // 10MB
            50 * 1024 * 1024, // 50MB
            100 * 1024 * 1024, // 100MB
            Infinity,
          ],
          default: "Other",
          output: {
            count: { $sum: 1 },
            totalSize: { $sum: "$size" },
          },
        },
      },
    ]);

    const sizeRanges = ["< 1MB", "1-10MB", "10-50MB", "50-100MB", "> 100MB"];
    const fileSizeDistributionFormatted = fileSizeDistribution.map(
      (bucket, index) => ({
        name: sizeRanges[index] || "Other",
        count: bucket.count,
        totalSize: bucket.totalSize,
      }),
    );

    // 10. Activity Timeline (Uploads & Registrations)
    // Use trendStart/trendEnd calculated above

    // File Activity
    const activityFileQuery = {
      createdAt: { $gte: trendStart },
    };
    if (trendEnd) activityFileQuery.createdAt.$lte = trendEnd;
    if (role && role !== "all" && fileQuery.owner) {
      activityFileQuery.owner = fileQuery.owner;
    }

    const fileActivityTimeline = await File.aggregate([
      { $match: activityFileQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          uploads: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // User Registration Activity
    const userRegQuery = {
      createdAt: { $gte: trendStart },
    };
    if (trendEnd) userRegQuery.createdAt.$lte = trendEnd;
    if (role && role !== "all") userRegQuery.role = role;

    const userRegistrationTimeline = await User.aggregate([
      { $match: userRegQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          registrations: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge timelines
    const activityMap = {};
    const addToMap = (date, type, count) => {
      if (!activityMap[date])
        activityMap[date] = { uploads: 0, registrations: 0 };
      activityMap[date][type] = count;
    };

    fileActivityTimeline.forEach((item) =>
      addToMap(item._id, "uploads", item.uploads),
    );
    userRegistrationTimeline.forEach((item) =>
      addToMap(item._id, "registrations", item.registrations),
    );

    const activityTimeline = Object.keys(activityMap)
      .sort()
      .map((date) => ({
        _id: date,
        uploads: activityMap[date].uploads,
        registrations: activityMap[date].registrations,
      }));

    // 11. User Growth Trend
    const userGrowthTrend = await User.aggregate([
      { $match: userRegQuery },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const userGrowthMap = {};
    userGrowthTrend.forEach((item) => {
      const date = item._id.date;
      const r = item._id.role;
      if (!userGrowthMap[date]) {
        userGrowthMap[date] = { date, admin: 0, family: 0, guest: 0, user: 0 };
      }
      userGrowthMap[date][r] = item.count;
    });
    const userGrowthData = Object.values(userGrowthMap);

    // 12. Upload Patterns by Hour
    const uploadPatternsByHour = await File.aggregate([
      { $match: activityFileQuery },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const hourlyPatterns = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      count: 0,
    }));
    uploadPatternsByHour.forEach((item) => {
      if (hourlyPatterns[item._id]) {
        hourlyPatterns[item._id].count = item.count;
      }
    });

    // 13. Storage Usage by Role
    // Usually specific to 'current' state, but we can filter which roles to show?
    // The request asks to "metrics update immediately based on filters".
    // If filtering by specific role, maybe only show that role?
    const roleQuery = {};
    if (role && role !== "all") {
      roleQuery.role = role;
    }

    const storageByRole = await User.aggregate([
      { $match: roleQuery },
      {
        $group: {
          _id: "$role",
          storage: { $sum: "$storageUsed" },
          users: { $sum: 1 },
        },
      },
      { $sort: { storage: -1 } },
    ]);

    const storageByRoleFormatted = storageByRole.map((item) => ({
      role: item._id.charAt(0).toUpperCase() + item._id.slice(1),
      storage: item.storage,
      users: item.users,
    }));

    // 14. Avg File Size by Type
    const avgFileSizeByType = await File.aggregate([
      { $match: fileQuery },
      {
        $group: {
          _id: "$type",
          avgSize: { $avg: "$size" },
          count: { $sum: 1 },
        },
      },
      { $sort: { avgSize: -1 } },
      { $limit: 10 },
    ]);

    const stats = {
      users: {
        total: totalUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        newThisWeek: newUsersCount,
        topStorageUsers: topStorageUsersWithCounts,
      },
      files: {
        total: totalFiles,
        inTrash: totalFilesInTrash,
        folders: totalFolders,
        sizeDistribution: fileSizeDistributionFormatted,
      },
      storage: {
        totalUsed: storageStats[0]?.totalStorage || 0,
        averageFileSize: storageStats[0]?.avgFileSize || 0,
        largestFile: storageStats[0]?.maxFileSize || 0,
        smallestFile: storageStats[0]?.minFileSize || 0,
        userTotalUsed: userStorageStats[0]?.totalUsed || 0,
        userAverageUsed: userStorageStats[0]?.avgUsed || 0,
        userMaxUsed: userStorageStats[0]?.maxUsed || 0,
      },
      fileTypes: fileTypeDistribution,
      activeUploads: activeUploadSessions,
      storageTrend: storageTrend,
      activityTimeline: activityTimeline,
      userGrowthTrend: userGrowthData,
      uploadPatternsByHour: hourlyPatterns,
      storageByRole: storageByRoleFormatted,
      avgFileSizeByType: avgFileSizeByType,
    };

    logger.info("System stats fetched successfully", {
      adminId: req.user.id,
      totalUsers,
      totalFiles,
    });

    res.json(stats);
  } catch (error) {
    logger.error("Error fetching system stats", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch system statistics" });
  }
});

/**
 * GET /api/admin/users
 * Get all users with pagination and filtering
 */
router.get("/users", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      role,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    logger.info("Admin fetching users list", {
      adminId: req.user.id,
      page,
      limit,
      role,
      search,
    });

    const query = {};

    // Filter by role
    if (role && ["admin", "family", "guest"].includes(role)) {
      query.role = role;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    // Get file counts for each user
    const userIds = users.map((u) => u._id);
    const fileCounts = await File.aggregate([
      { $match: { owner: { $in: userIds }, trash: false } },
      { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]);

    const fileCountMap = fileCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const usersWithCounts = users.map((user) => ({
      ...user.toObject(),
      fileCount: fileCountMap[user._id.toString()] || 0,
    }));

    res.json({
      users: usersWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching users list", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed information about a specific user
 */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    logger.info("Admin fetching user details", {
      adminId: req.user.id,
      targetUserId: userId,
    });

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's file statistics
    const fileStats = await File.aggregate([
      { $match: { owner: user._id, trash: false } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSize: { $sum: "$size" },
        },
      },
    ]);

    // Get user's folder count
    const folderCount = await Folder.countDocuments({
      owner: user._id,
      trash: false,
    });

    // Get user's recent files
    const recentFiles = await File.find({ owner: user._id, trash: false })
      .sort({ uploadedAt: -1 })
      .limit(10)
      .select("name size mimeType uploadedAt");

    const userDetails = {
      ...user.toObject(),
      statistics: {
        fileCount: fileStats[0]?.count || 0,
        totalStorageUsed: fileStats[0]?.totalSize || 0,
        folderCount,
      },
      recentFiles,
    };

    res.json(userDetails);
  } catch (error) {
    logger.error("Error fetching user details", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Update user's role
 */
router.put("/users/:userId/role", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["admin", "family", "guest", "user"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    logger.info("Admin updating user role", {
      adminId: req.user.id,
      targetUserId: userId,
      newRole: role,
    });

    // Prevent self-demotion from admin
    if (
      userId === req.user.id &&
      req.user.role === "admin" &&
      role !== "admin"
    ) {
      return res.status(400).json({
        error: "Cannot change your own admin role",
        code: "SELF_DEMOTION_PREVENTED",
      });
    }

    // Prevent assigning guest role manually
    if (role === "guest") {
      return res.status(400).json({
        error: "Cannot manually assign Guest role",
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent changing role of a guest user
    if (user.role === "guest") {
      return res.status(400).json({
        error: "Cannot change role of a Guest user",
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save(); // This will trigger the pre-save hook to update storageLimit

    logger.info("User role updated successfully", {
      adminId: req.user.id,
      targetUserId: userId,
      oldRole,
      newRole: role,
      newStorageLimit: user.storageLimit,
    });

    res.json({
      message: "User role updated successfully",
      user: user.toObject(),
    });
  } catch (error) {
    logger.error("Error updating user role", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to update user role" });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their files
 */
router.delete("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    logger.info("Admin deleting user", {
      adminId: req.user.id,
      targetUserId: userId,
    });

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({
        error: "Cannot delete your own account",
        code: "SELF_DELETION_PREVENTED",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete user's files from database
    const deletedFilesResult = await File.deleteMany({ owner: userId });

    // Delete user's folders from database
    const deletedFoldersResult = await Folder.deleteMany({ owner: userId });

    // Delete user's upload sessions
    await UploadSession.deleteMany({ userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    logger.info("User deleted successfully", {
      adminId: req.user.id,
      deletedUserId: userId,
      deletedFiles: deletedFilesResult.deletedCount,
      deletedFolders: deletedFoldersResult.deletedCount,
    });

    res.json({
      message: "User deleted successfully",
      deletedFiles: deletedFilesResult.deletedCount,
      deletedFolders: deletedFoldersResult.deletedCount,
    });
  } catch (error) {
    logger.error("Error deleting user", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/**
 * GET /api/admin/files
 * Get all files across all users with pagination
 */
router.get("/files", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      mimeType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    logger.info("Admin fetching files list", {
      adminId: req.user.id,
      page,
      limit,
      userId,
      mimeType,
    });

    const query = { trash: false };

    // Filter by user
    if (userId) {
      query.owner = userId;
    }

    // Filter by mime type category (File model uses 'type' not 'mimeType')
    if (mimeType) {
      query.type = { $regex: mimeType, $options: "i" };
    }

    // Search by filename
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [files, total] = await Promise.all([
      File.find(query)
        .populate("owner", "name email role")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      File.countDocuments(query),
    ]);

    // Log files with null owners for debugging
    const filesWithNullOwner = files.filter((file) => !file.owner);
    if (filesWithNullOwner.length > 0) {
      logger.warn("Files with null owner found", {
        count: filesWithNullOwner.length,
        fileIds: filesWithNullOwner.map((f) => f._id),
      });
    }

    // Add mimeType field for backwards compatibility (map 'type' to 'mimeType')
    const filesWithMimeType = files.map((file) => ({
      ...file,
      mimeType: file.type,
      uploadedAt: file.createdAt,
    }));

    res.json({
      files: filesWithMimeType,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching files list", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/**
 * DELETE /api/admin/files/:fileId
 * Delete a file (admin override)
 */
router.delete("/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    logger.info("Admin deleting file", {
      adminId: req.user.id,
      fileId,
    });

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileOwner = await User.findById(file.owner);

    // Delete file from database
    await File.findByIdAndDelete(fileId);

    // Update user's storage if owner exists
    if (fileOwner) {
      fileOwner.storageUsed = Math.max(0, fileOwner.storageUsed - file.size);
      await fileOwner.save();
    }

    logger.info("File deleted by admin", {
      adminId: req.user.id,
      fileId,
      fileName: file.name,
      fileOwner: file.owner,
      fileSize: file.size,
    });

    res.json({
      message: "File deleted successfully",
      file: {
        id: file._id,
        name: file.name,
        size: file.size,
      },
    });
  } catch (error) {
    logger.error("Error deleting file", {
      adminId: req.user.id,
      fileId: req.params.fileId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to delete file" });
  }
});

/**
 * GET /api/admin/activity
 * Get recent system activity (simplified version - expand as needed)
 */
router.get("/activity", async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    logger.info("Admin fetching system activity", {
      adminId: req.user.id,
      limit,
    });

    // Get recent file uploads
    const recentUploads = await File.find({ trash: false })
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("name size mimeType createdAt owner");

    // Get recent user registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select("name email role createdAt");

    const activity = {
      recentUploads: recentUploads.map((file) => ({
        type: "file_upload",
        timestamp: file.createdAt,
        user: file.owner,
        details: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.mimeType,
        },
      })),
      recentRegistrations: recentUsers.map((user) => ({
        type: "user_registration",
        timestamp: user.createdAt,
        details: {
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        },
      })),
    };

    res.json(activity);
  } catch (error) {
    logger.error("Error fetching system activity", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch system activity" });
  }
});

/**
 * GET /api/admin/storage-report
 * Get detailed storage report by user
 */
router.get("/storage-report", async (req, res) => {
  try {
    logger.info("Admin fetching storage report", { adminId: req.user.id });

    const storageReport = await User.aggregate([
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          storageUsed: 1,
          storageLimit: 1,
          storagePercent: {
            $cond: {
              if: { $eq: ["$storageLimit", -1] },
              then: 0,
              else: {
                $multiply: [
                  { $divide: ["$storageUsed", "$storageLimit"] },
                  100,
                ],
              },
            },
          },
        },
      },
      { $sort: { storageUsed: -1 } },
    ]);

    res.json({ users: storageReport });
  } catch (error) {
    logger.error("Error fetching storage report", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch storage report" });
  }
});

/**
 * GET /api/admin/dashboard/preferences
 * Get admin's dashboard preferences (visible widgets and order)
 */
router.get("/dashboard/preferences", async (req, res) => {
  try {
    logger.info("Admin fetching dashboard preferences", {
      adminId: req.user.id,
    });

    const user = await User.findById(req.user.id).select(
      "dashboardPreferences",
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return preferences or defaults
    const preferences = {
      visibleWidgets: user.dashboardPreferences?.visibleWidgets || null,
      widgetOrder: user.dashboardPreferences?.widgetOrder || null,
    };

    res.json(preferences);
  } catch (error) {
    logger.error("Error fetching dashboard preferences", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch dashboard preferences" });
  }
});

/**
 * PUT /api/admin/dashboard/preferences
 * Save admin's dashboard preferences (visible widgets and order)
 */
router.put("/dashboard/preferences", async (req, res) => {
  try {
    const { visibleWidgets, widgetOrder } = req.body;

    logger.info("Admin saving dashboard preferences", {
      adminId: req.user.id,
      visibleWidgetsCount: visibleWidgets?.length,
      widgetOrderCount: widgetOrder?.length,
    });

    // Validate input
    if (visibleWidgets && !Array.isArray(visibleWidgets)) {
      return res.status(400).json({ error: "visibleWidgets must be an array" });
    }
    if (widgetOrder && !Array.isArray(widgetOrder)) {
      return res.status(400).json({ error: "widgetOrder must be an array" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update preferences
    user.dashboardPreferences = {
      visibleWidgets: visibleWidgets || null,
      widgetOrder: widgetOrder || null,
    };

    await user.save();

    logger.info("Dashboard preferences saved successfully", {
      adminId: req.user.id,
      visibleWidgets: user.dashboardPreferences.visibleWidgets,
    });

    res.json({
      message: "Dashboard preferences saved successfully",
      preferences: user.dashboardPreferences,
    });
  } catch (error) {
    logger.error("Error saving dashboard preferences", {
      adminId: req.user.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to save dashboard preferences" });
  }
});

module.exports = router;
