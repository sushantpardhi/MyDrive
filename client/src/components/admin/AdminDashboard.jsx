import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Files,
  HardDrive,
  Activity,
  ArrowUpRight,
  Settings,
} from "lucide-react";
import { useAdmin } from "../../contexts";
import { useAuth } from "../../contexts";
import { formatFileSize } from "../../utils/formatters";
import logger from "../../utils/logger";
import styles from "./AdminDashboard.module.css";
import LoadingSpinner from "../common/LoadingSpinner";
import DashboardCustomizer, {
  DEFAULT_VISIBLE_WIDGETS,
} from "./DashboardCustomizer";
import { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Custom WidthProvider implementation since it's missing from the package exports
const withWidth = (Component) => {
  return (props) => {
    const [width, setWidth] = React.useState(1200);
    const elementRef = React.useRef(null);

    React.useEffect(() => {
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries[0]) {
          setWidth(entries[0].contentRect.width);
        }
      });

      if (elementRef.current) {
        resizeObserver.observe(elementRef.current);
        // Set initial width
        setWidth(elementRef.current.offsetWidth);
      }

      return () => resizeObserver.disconnect();
    }, []);

    return (
      <div ref={elementRef} style={{ width: "100%" }}>
        <Component {...props} width={width} />
      </div>
    );
  };
};

// Custom Resize Handle
const ResizeHandle = React.forwardRef(({ handleAxis, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`${styles.resizeHandle} react-resizable-handle react-resizable-handle-${handleAxis}`}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          opacity="0"
        />
        <polyline points="21 15 21 21 15 21" />
      </svg>
    </div>
  );
});

const ResponsiveGridLayout = withWidth(Responsive);

// Widget Configuration with default sizes
const WIDGET_CONFIG = {
  storageCapacity: { w: 2, h: 2, minW: 1, minH: 2 },
  userDistribution: { w: 2, h: 2, minW: 1, minH: 2 },
  topFileTypes: { w: 2, h: 3, minW: 2, minH: 3 },
  storageTrend: { w: 4, h: 3, minW: 2, minH: 2 },
  topStorageUsers: { w: 2, h: 3, minW: 2, minH: 3 },
  fileSizeDistribution: { w: 2, h: 3, minW: 2, minH: 2 },
  activityTimeline: { w: 4, h: 3, minW: 2, minH: 2 },
  storageByFileType: { w: 2, h: 3, minW: 2, minH: 3 },
  userGrowthTrend: { w: 4, h: 3, minW: 2, minH: 2 },
  uploadPatternsByHour: { w: 4, h: 3, minW: 2, minH: 3 },
  storageByRole: { w: 2, h: 2, minW: 1, minH: 2 },
  trashStatistics: { w: 2, h: 2, minW: 1, minH: 2 },
  avgFileSizeByType: { w: 2, h: 3, minW: 2, minH: 3 },
};

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
  const {
    systemStats,
    loading,
    fetchSystemStats,
    dashboardPreferences,
    fetchDashboardPreferences,
    saveDashboardPreferences,
  } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const [layouts, setLayouts] = useState({ lg: [] });
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [prefsLoading, setPrefsLoading] = useState(true);

  // Get visible widgets from preferences or use defaults
  const visibleWidgets = useMemo(() => {
    return dashboardPreferences?.visibleWidgets || DEFAULT_VISIBLE_WIDGETS;
  }, [dashboardPreferences]);

  // Generate initial layout based on visible widgets
  useEffect(() => {
    // Current layout from state or default
    const currentLayout = layouts.lg || [];

    // Check if we have a saved layout in preferences
    const savedLayout = dashboardPreferences?.widgetOrder;

    if (savedLayout && savedLayout.length > 0) {
      // We have a saved layout.
      // But we need to make sure it matches visibleWidgets.

      // 1. Filter out widgets that are no longer visible
      let newLayout = savedLayout.filter((item) =>
        visibleWidgets.includes(item.i),
      );

      // 2. Add widgets that are visible but not in the saved layout
      const missingWidgets = visibleWidgets.filter(
        (widgetId) => !newLayout.find((item) => item.i === widgetId),
      );

      if (missingWidgets.length > 0) {
        // Find the bottom of the current layout to append new items
        let maxY = 0;
        newLayout.forEach((item) => {
          if (item.y + item.h > maxY) maxY = item.y + item.h;
        });

        const addedItems = missingWidgets.map((widgetId, index) => {
          const config = WIDGET_CONFIG[widgetId] || { w: 2, h: 2 };
          return {
            i: widgetId,
            x: (index * 2) % 4,
            y: maxY + Math.floor(index / 2) * 2, // Append at bottom
            w: config.w,
            h: config.h,
            minW: config.minW || 2,
            minH: config.minH || 2,
          };
        });

        newLayout = [...newLayout, ...addedItems];
      }

      // Update state if different
      if (JSON.stringify(newLayout) !== JSON.stringify(currentLayout)) {
        setLayouts((prev) => ({ ...prev, lg: newLayout }));
      }
    } else {
      // No saved layout, generate default for all visible widgets
      const generatedLayout = visibleWidgets.map((widgetId, index) => {
        const config = WIDGET_CONFIG[widgetId] || { w: 2, h: 2 };
        return {
          i: widgetId,
          x: (index * 2) % 4,
          y: Math.floor(index / 2) * 2,
          w: config.w,
          h: config.h,
          minW: config.minW || 2,
          minH: config.minH || 2,
        };
      });
      if (JSON.stringify(generatedLayout) !== JSON.stringify(layouts.lg)) {
        setLayouts((prev) => ({ ...prev, lg: generatedLayout }));
      }
    }
  }, [dashboardPreferences, visibleWidgets]); // Removed layouts.lg dependency to avoid loops

  const onLayoutChange = (currentLayout, allLayouts) => {
    // Update local state with ALL layouts to preserve state across breakpoints
    setLayouts(allLayouts);
  };

  const handleLayoutSave = async (layoutToSave) => {
    // Only save to DB if we are on the main desktop breakpoint (lg)
    // This prevents mobile layouts (1 column) from overwriting the desktop configuration
    if (currentBreakpoint !== "lg") {
      return;
    }

    // layoutToSave comes from onDragStop/onResizeStop which passes the current layout array.
    // If not passed (e.g. manual call), use layouts.lg
    const targetLayout = Array.isArray(layoutToSave)
      ? layoutToSave
      : layouts.lg;

    const simplifiedLayout = targetLayout.map(({ i, x, y, w, h }) => ({
      i,
      x,
      y,
      w,
      h,
    }));

    await saveDashboardPreferences({
      visibleWidgets,
      widgetOrder: simplifiedLayout,
    });
  };

  // Helper to check if a widget is visible
  const isWidgetVisible = (widgetId) => visibleWidgets.includes(widgetId);

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

    const initDashboard = async () => {
      setPrefsLoading(true);
      try {
        await Promise.all([loadStats(), fetchDashboardPreferences()]);
      } catch (error) {
        logger.error("Error initializing dashboard", { error });
      } finally {
        setPrefsLoading(false);
      }
    };

    initDashboard();
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
        "application/vnd.openxmlformats-officedocument.spreadsheetml",
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
        "application/vnd.openxmlformats-officedocument.wordprocessingml",
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
        "application/vnd.openxmlformats-officedocument.presentationml",
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
      {/* Dashboard Customizer Modal */}
      <DashboardCustomizer
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        currentPreferences={dashboardPreferences}
        onSave={saveDashboardPreferences}
      />

      {/* Minimal Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>System Overview</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.customizeButton}
            onClick={() => setShowCustomizer(true)}
          >
            <Settings size={18} />
            Customize
          </button>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <Activity size={18} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
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

      {/* Charts Grid - Replaced with ResponsiveGridLayout */}
      {prefsLoading || (loading && !systemStats) ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 }}
          rowHeight={100}
          draggableHandle=".drag-handle"
          onBreakpointChange={setCurrentBreakpoint}
          onLayoutChange={onLayoutChange}
          onDragStop={handleLayoutSave}
          onResizeStop={handleLayoutSave}
          resizeHandle={<ResizeHandle />}
        >
          {/* Storage Capacity Gauge */}
          {isWidgetVisible("storageCapacity") && (
            <div key="storageCapacity" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <StorageCapacityGauge storageStats={storageStats} />
            </div>
          )}

          {/* User Distribution */}
          {isWidgetVisible("userDistribution") && (
            <div key="userDistribution" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <UserDistributionChart userStats={userStats} />
            </div>
          )}

          {/* Top File Types */}
          {isWidgetVisible("topFileTypes") && (
            <div key="topFileTypes" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <TopFileTypesChart
                fileTypes={fileTypes}
                getFileTypeLabel={getFileTypeLabel}
              />
            </div>
          )}

          {/* Storage Trend (30 Days) */}
          {isWidgetVisible("storageTrend") && (
            <div key="storageTrend" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <StorageTrendChart storageTrendData={storageTrendData} />
            </div>
          )}

          {/* Top Storage Users */}
          {isWidgetVisible("topStorageUsers") && (
            <div key="topStorageUsers" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <TopStorageUsersChart storageByUserData={storageByUserData} />
            </div>
          )}

          {/* File Size Distribution */}
          {isWidgetVisible("fileSizeDistribution") && (
            <div key="fileSizeDistribution" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <FileSizeDistributionChart
                fileSizeDistribution={fileSizeDistribution}
              />
            </div>
          )}

          {/* Activity Timeline */}
          {isWidgetVisible("activityTimeline") && (
            <div key="activityTimeline" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <ActivityTimelineChart
                activityTimelineData={activityTimelineData}
              />
            </div>
          )}

          {/* Storage by File Type */}
          {isWidgetVisible("storageByFileType") && (
            <div key="storageByFileType" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <StorageByFileTypeChart
                storageByFileTypeData={storageByFileTypeData}
              />
            </div>
          )}

          {/* User Growth Trend (30 Days) */}
          {isWidgetVisible("userGrowthTrend") &&
            systemStats?.userGrowthTrend && (
              <div key="userGrowthTrend" className={styles.gridItem}>
                <div className={`${styles.dragHandle} drag-handle`}>::</div>
                <UserGrowthTrendChart
                  userGrowthData={systemStats.userGrowthTrend}
                />
              </div>
            )}

          {/* Upload Patterns by Hour */}
          {isWidgetVisible("uploadPatternsByHour") &&
            systemStats?.uploadPatternsByHour && (
              <div key="uploadPatternsByHour" className={styles.gridItem}>
                <div className={`${styles.dragHandle} drag-handle`}>::</div>
                <UploadPatternsByHourChart
                  uploadPatternData={systemStats.uploadPatternsByHour}
                />
              </div>
            )}

          {/* Storage Usage by Role */}
          {isWidgetVisible("storageByRole") && systemStats?.storageByRole && (
            <div key="storageByRole" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <StorageByRoleChart
                storageByRoleData={systemStats.storageByRole}
              />
            </div>
          )}

          {/* Trash Statistics */}
          {isWidgetVisible("trashStatistics") && (
            <div key="trashStatistics" className={styles.gridItem}>
              <div className={`${styles.dragHandle} drag-handle`}>::</div>
              <TrashStatisticsChart
                fileStats={fileStats}
                storageStats={storageStats}
              />
            </div>
          )}

          {/* Average File Size by Type */}
          {isWidgetVisible("avgFileSizeByType") &&
            systemStats?.avgFileSizeByType && (
              <div key="avgFileSizeByType" className={styles.gridItem}>
                <div className={`${styles.dragHandle} drag-handle`}>::</div>
                <AverageFileSizeByTypeChart
                  averageFileSizeData={systemStats.avgFileSizeByType.map(
                    (item) => ({
                      type: getFileTypeLabel(item._id),
                      avgSize: item.avgSize,
                      count: item.count,
                    }),
                  )}
                />
              </div>
            )}
        </ResponsiveGridLayout>
      )}

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <div className={styles.emptyState}>
          <Settings size={48} />
          <h3>No Widgets Selected</h3>
          <p>Click "Customize" to add widgets to your dashboard.</p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
