import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Files, HardDrive, Activity, ArrowUpRight } from "lucide-react";
import { useAdmin } from "../../contexts";
import { useAuth } from "../../contexts";
import { formatFileSize } from "../../utils/formatters";
import logger from "../../utils/logger";
import styles from "./AdminDashboard.module.css";

// Import all chart components
import {
  UserDistributionChart,
  TopFileTypesChart,
  StorageTrendChart,
  TopStorageUsersChart,
  FileSizeDistributionChart,
  ActivityTimelineChart,
  StorageByFileTypeChart,
  StorageCapacityGauge,
  UserGrowthTrendChart,
  UploadPatternsByHourChart,
  StorageByRoleChart,
  TrashStatisticsChart,
  AverageFileSizeByTypeChart,
} from "./charts";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { systemStats, loading, fetchSystemStats } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    logger.info("AdminDashboard mounted", { userId: user?.id });

    if (user && user.role !== "admin") {
      logger.warn("Non-admin user attempted to access admin dashboard", {
        userId: user.id,
        role: user.role,
      });
      navigate("/drive");
      return;
    }

    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      await fetchSystemStats();
    } catch (error) {
      logger.error("Failed to load system stats", { error: error.message });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  // Helper function to get readable file type label from MIME type
  const getFileTypeLabel = (mimeType) => {
    if (!mimeType || mimeType.trim() === "") return "Other";

    // Map common MIME types to readable names
    const mimeTypeMap = {
      "application/pdf": "PDF",
      "image/jpeg": "JPEG",
      "image/jpg": "JPG",
      "image/png": "PNG",
      "image/gif": "GIF",
      "image/svg+xml": "SVG",
      "video/mp4": "MP4",
      "video/avi": "AVI",
      "audio/mpeg": "MP3",
      "audio/wav": "WAV",
      "application/zip": "ZIP",
      "application/x-rar": "RAR",
      "text/plain": "TXT",
      "text/csv": "CSV",
    };

    // Check if we have a direct mapping
    if (mimeTypeMap[mimeType]) {
      return mimeTypeMap[mimeType];
    }

    // Check for Office document types
    if (
      mimeType.startsWith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml"
      )
    ) {
      return "XLSX";
    } else if (
      mimeType.startsWith("application/vnd.ms-excel") ||
      mimeType === ".xls"
    ) {
      return "XLS";
    } else if (
      mimeType.startsWith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml"
      )
    ) {
      return "DOCX";
    } else if (
      mimeType.startsWith("application/msword") ||
      mimeType === ".doc"
    ) {
      return "DOC";
    } else if (
      mimeType.startsWith(
        "application/vnd.openxmlformats-officedocument.presentationml"
      )
    ) {
      return "PPTX";
    } else if (
      mimeType.startsWith("application/vnd.ms-powerpoint") ||
      mimeType === ".ppt"
    ) {
      return "PPT";
    }

    // Check for generic types
    if (mimeType.startsWith("image/")) {
      return "Image";
    } else if (mimeType.startsWith("video/")) {
      return "Video";
    } else if (mimeType.startsWith("audio/")) {
      return "Audio";
    }

    // Handle file extensions
    if (mimeType.startsWith(".")) {
      return mimeType.substring(1).toUpperCase();
    }

    // Extract last part after slash
    const parts = mimeType.split("/");
    return parts[parts.length - 1].toUpperCase();
  };

  // Process storage trend data - must be before early returns
  const storageTrendData = React.useMemo(() => {
    if (!systemStats?.storageTrend || systemStats.storageTrend.length === 0) {
      // Fallback to showing current storage if no trend data
      if (!systemStats?.storage?.totalUsed) return [];
      return [
        {
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          storage: systemStats.storage.totalUsed,
        },
      ];
    }

    // Calculate cumulative storage over time
    let cumulativeStorage = 0;
    return systemStats.storageTrend.map((item) => {
      cumulativeStorage += item.totalSize;
      const date = new Date(item._id);
      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        storage: cumulativeStorage,
        files: item.count,
      };
    });
  }, [systemStats]);

  // Storage by user data
  const storageByUserData = React.useMemo(() => {
    if (!systemStats?.users?.topStorageUsers) return [];
    logger.debug("Processing storage by user data", {
      topUsersCount: systemStats.users.topStorageUsers.length,
    });
    return systemStats.users.topStorageUsers.slice(0, 5).map((user) => ({
      name: user.name?.split(" ")[0] || "Unknown",
      storage: user.storageUsed || 0,
      files: user.fileCount || 0,
    }));
  }, [systemStats]);

  // File size distribution data
  const fileSizeDistribution = React.useMemo(() => {
    const ranges = [
      { name: "< 1MB", count: 0, range: [0, 1024 * 1024] },
      { name: "1-10MB", count: 0, range: [1024 * 1024, 10 * 1024 * 1024] },
      {
        name: "10-50MB",
        count: 0,
        range: [10 * 1024 * 1024, 50 * 1024 * 1024],
      },
      {
        name: "50-100MB",
        count: 0,
        range: [50 * 1024 * 1024, 100 * 1024 * 1024],
      },
      { name: "> 100MB", count: 0, range: [100 * 1024 * 1024, Infinity] },
    ];

    if (systemStats?.files?.sizeDistribution) {
      logger.debug("Processing file size distribution data", {
        rangesCount: systemStats.files.sizeDistribution.length,
      });
      return systemStats.files.sizeDistribution;
    }

    return ranges;
  }, [systemStats]);

  // Activity timeline data
  const activityTimelineData = React.useMemo(() => {
    if (
      !systemStats?.activityTimeline ||
      systemStats.activityTimeline.length === 0
    ) {
      return [];
    }
    logger.debug("Processing activity timeline data", {
      daysCount: systemStats.activityTimeline.length,
    });
    return systemStats.activityTimeline.map((item) => {
      const date = new Date(item._id);
      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        uploads: item.uploads || 0,
        registrations: item.registrations || 0,
      };
    });
  }, [systemStats]);

  // Storage by file type data
  const storageByFileTypeData = React.useMemo(() => {
    if (!systemStats?.fileTypes || systemStats.fileTypes.length === 0) {
      return [];
    }
    logger.debug("Processing storage by file type data", {
      fileTypesCount: systemStats.fileTypes.length,
    });
    return systemStats.fileTypes.slice(0, 8).map((item) => ({
      type: getFileTypeLabel(item._id),
      size: item.totalSize || 0,
      count: item.count || 0,
    }));
  }, [systemStats]);

  if (loading && !systemStats) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (!systemStats) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load dashboard data</div>
      </div>
    );
  }

  const {
    users: userStats,
    files: fileStats,
    storage: storageStats,
    fileTypes,
    activeUploads,
    storageTrend,
  } = systemStats;

  return (
    <div className={styles.container}>
      {/* Minimal Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>System Overview</p>
        </div>
        <button
          className={styles.refreshButton}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <Activity size={18} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {/* Stats Overview - Minimal Cards */}
      <div className={styles.statsRow}>
        <div
          className={styles.metricCard}
          onClick={() => navigate("/admin/users")}
        >
          <div className={styles.metricHeader}>
            <Users size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Users</span>
          </div>
          <div className={styles.metricValue}>{userStats.total}</div>
          <div className={styles.metricChange}>
            <ArrowUpRight size={14} />
            <span>+{userStats.newThisWeek} this week</span>
          </div>
        </div>

        <div
          className={styles.metricCard}
          onClick={() => navigate("/admin/files")}
        >
          <div className={styles.metricHeader}>
            <Files size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Files</span>
          </div>
          <div className={styles.metricValue}>{fileStats.total}</div>
          <div className={styles.metricChange}>
            <span className={styles.metricSubtext}>
              {fileStats.inTrash} in trash
            </span>
          </div>
        </div>

        <div
          className={styles.metricCard}
          onClick={() => navigate("/admin/storage")}
        >
          <div className={styles.metricHeader}>
            <HardDrive size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Storage</span>
          </div>
          <div className={styles.metricValue}>
            {formatFileSize(storageStats.totalUsed)}
          </div>
          <div className={styles.metricChange}>
            <span className={styles.metricSubtext}>
              Avg: {formatFileSize(storageStats.averageFileSize)}
            </span>
          </div>
        </div>

        <div
          className={styles.metricCard}
          onClick={() => navigate("/admin/activity")}
        >
          <div className={styles.metricHeader}>
            <Activity size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Activity</span>
          </div>
          <div className={styles.metricValue}>{activeUploads}</div>
          <div className={styles.metricChange}>
            <span className={styles.metricSubtext}>Active uploads</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        {/* Storage Capacity Gauge */}
        <StorageCapacityGauge storageStats={storageStats} />

        {/* User Distribution */}
        <UserDistributionChart userStats={userStats} />

        {/* Top File Types */}
        <TopFileTypesChart
          fileTypes={fileTypes}
          getFileTypeLabel={getFileTypeLabel}
        />

        {/* Storage Trend (30 Days) */}
        <StorageTrendChart storageTrendData={storageTrendData} />

        {/* Top Storage Users */}
        <TopStorageUsersChart storageByUserData={storageByUserData} />

        {/* File Size Distribution */}
        <FileSizeDistributionChart
          fileSizeDistribution={fileSizeDistribution}
        />

        {/* Activity Timeline */}
        <ActivityTimelineChart activityTimelineData={activityTimelineData} />

        {/* Storage by File Type */}
        <StorageByFileTypeChart storageByFileTypeData={storageByFileTypeData} />

        {/* User Growth Trend (30 Days) */}
        {systemStats?.userGrowthTrend && (
          <UserGrowthTrendChart userGrowthData={systemStats.userGrowthTrend} />
        )}

        {/* Upload Patterns by Hour */}
        {systemStats?.uploadPatternsByHour && (
          <UploadPatternsByHourChart
            uploadPatternData={systemStats.uploadPatternsByHour}
          />
        )}

        {/* Storage Usage by Role */}
        {systemStats?.storageByRole && (
          <StorageByRoleChart storageByRoleData={systemStats.storageByRole} />
        )}

        {/* Trash Statistics */}
        <TrashStatisticsChart
          fileStats={fileStats}
          storageStats={storageStats}
        />

        {/* Average File Size by Type */}
        {systemStats?.avgFileSizeByType && (
          <AverageFileSizeByTypeChart
            averageFileSizeData={systemStats.avgFileSizeByType.map((item) => ({
              type: getFileTypeLabel(item._id),
              avgSize: item.avgSize,
              count: item.count,
            }))}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
