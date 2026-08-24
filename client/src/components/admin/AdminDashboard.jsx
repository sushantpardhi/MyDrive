import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Files,
  HardDrive,
  Activity,
  ArrowUpRight,
  Settings,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Trash2,
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
import DashboardFilters from "./DashboardFilters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIME_MAP = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/webp": "WEBP",
  "video/mp4": "MP4",
  "video/avi": "AVI",
  "video/quicktime": "MOV",
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "application/zip": "ZIP",
  "application/x-rar-compressed": "RAR",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

const OFFICE_MAP = [
  ["spreadsheetml", "XLSX"],
  ["vnd.ms-excel", "XLS"],
  ["wordprocessingml", "DOCX"],
  ["msword", "DOC"],
  ["presentationml", "PPTX"],
  ["vnd.ms-powerpoint", "PPT"],
];

function getFileTypeLabel(mimeType) {
  if (!mimeType || !mimeType.trim()) return "Other";
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  for (const [key, label] of OFFICE_MAP) {
    if (mimeType.includes(key)) return label;
  }
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith(".")) return mimeType.slice(1).toUpperCase();
  const parts = mimeType.split("/");
  return parts[parts.length - 1].toUpperCase();
}

function defaultFilters() {
  try {
    const saved = localStorage.getItem("adminDashboardFilters");
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { startDate: start.toISOString(), endDate: end.toISOString(), role: "all" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [resettingLayout, setResettingLayout] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);

  useEffect(() => {
    localStorage.setItem("adminDashboardFilters", JSON.stringify(filters));
  }, [filters]);

  const onFilterChange = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const visibleWidgets = useMemo(
    () => dashboardPreferences?.visibleWidgets ?? DEFAULT_VISIBLE_WIDGETS,
    [dashboardPreferences],
  );

  const isWidgetVisible = useCallback(
    (id) => visibleWidgets.includes(id),
    [visibleWidgets],
  );

  // Initialise on mount and whenever user or filters change
  useEffect(() => {
    if (!user) return;

    if (user.role !== "admin") {
      logger.warn("Non-admin attempted admin dashboard", { userId: user.id, role: user.role });
      navigate("/drive");
      return;
    }

    const init = async () => {
      setPrefsLoading(true);
      try {
        await Promise.all([fetchSystemStats(filters), fetchDashboardPreferences()]);
      } catch (err) {
        logger.error("Dashboard init failed", { error: err?.message });
      } finally {
        setPrefsLoading(false);
      }
    };

    init();
  }, [user, filters]); // intentionally omit fetchSystemStats / fetchDashboardPreferences (stable callbacks)

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSystemStats(filters);
    } catch (err) {
      logger.error("Refresh failed", { error: err?.message });
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetLayout = async () => {
    if (!window.confirm("Reset widget visibility to defaults?")) return;
    setResettingLayout(true);
    try {
      await saveDashboardPreferences({ visibleWidgets: DEFAULT_VISIBLE_WIDGETS, widgetOrder: [] });
    } catch (err) {
      logger.error("Reset layout failed", { error: err?.message });
    } finally {
      setResettingLayout(false);
    }
  };

  // Derived data
  const storageTrendData = useMemo(() => {
    if (!systemStats?.storageTrend?.length) {
      const total = systemStats?.storage?.totalUsed;
      if (!total) return [];
      return [{ date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), storage: total, files: 0 }];
    }
    let cumulative = 0;
    return systemStats.storageTrend.map((item) => {
      cumulative += item.totalSize;
      const d = new Date(item._id);
      return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), storage: cumulative, files: item.count };
    });
  }, [systemStats]);

  const storageByUserData = useMemo(() =>
    (systemStats?.users?.topStorageUsers ?? []).slice(0, 5).map((u) => ({
      name: u.name?.split(" ")[0] ?? "Unknown",
      storage: u.storageUsed ?? 0,
      files: u.fileCount ?? 0,
    })),
    [systemStats],
  );

  const fileSizeDistribution = useMemo(
    () => systemStats?.files?.sizeDistribution ?? [],
    [systemStats],
  );

  const activityTimelineData = useMemo(() =>
    (systemStats?.activityTimeline ?? []).map((item) => {
      const d = new Date(item._id);
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        uploads: item.uploads ?? 0,
        registrations: item.registrations ?? 0,
      };
    }),
    [systemStats],
  );

  const storageByFileTypeData = useMemo(() =>
    (systemStats?.fileTypes ?? []).slice(0, 8).map((item) => ({
      type: getFileTypeLabel(item._id),
      size: item.totalSize ?? 0,
      count: item.count ?? 0,
    })),
    [systemStats],
  );

  // Guards
  if ((loading || prefsLoading) && !systemStats) {
    return (
      <div className={styles.container}>
        <div className={styles.centeredState}>
          <LoadingSpinner />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!systemStats) {
    return (
      <div className={styles.container}>
        <div className={styles.centeredState}>
          <p className={styles.errorText}>
            Failed to load dashboard data.{" "}
            <button className={styles.retryBtn} onClick={handleRefresh}>Retry</button>
          </p>
        </div>
      </div>
    );
  }

  const { users: userStats, files: fileStats, storage: storageStats, fileTypes, activeUploads } = systemStats;

  return (
    <div className={styles.container}>
      {/* Widget customizer modal */}
      <DashboardCustomizer
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        currentPreferences={dashboardPreferences}
        onSave={saveDashboardPreferences}
      />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>System Overview</p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={handleResetLayout}
            disabled={resettingLayout}
            title="Reset widget visibility to defaults"
          >
            <RotateCcw size={16} />
            {resettingLayout ? "Resetting…" : "Reset"}
          </button>

          <button className={styles.actionBtn} onClick={() => setShowCustomizer(true)}>
            <Settings size={16} />
            Customize
          </button>

          <button
            className={`${styles.actionBtn} ${styles.primaryBtn}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? styles.spinning : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters filters={filters} onFilterChange={onFilterChange} />

      {/* Summary cards */}
      <div className={styles.statsRow}>
        <button className={styles.metricCard} onClick={() => navigate("/admin/users")}>
          <div className={styles.metricHeader}>
            <div className={`${styles.metricIconWrap} ${styles.iconBlue}`}><Users size={18} /></div>
            <span className={styles.metricLabel}>Total Users</span>
          </div>
          <div className={styles.metricValue}>{userStats.total}</div>
          <div className={styles.metricFooter}>
            <ArrowUpRight size={13} /><span>+{userStats.newThisWeek} this week</span>
          </div>
        </button>

        <button className={styles.metricCard} onClick={() => navigate("/admin/files")}>
          <div className={styles.metricHeader}>
            <div className={`${styles.metricIconWrap} ${styles.iconGreen}`}><Files size={18} /></div>
            <span className={styles.metricLabel}>Total Files</span>
          </div>
          <div className={styles.metricValue}>{fileStats.total}</div>
          <div className={styles.metricFooter}>
            <Trash2 size={13} /><span>{fileStats.inTrash} in trash</span>
          </div>
        </button>

        <button className={styles.metricCard} onClick={() => navigate("/admin/storage")}>
          <div className={styles.metricHeader}>
            <div className={`${styles.metricIconWrap} ${styles.iconOrange}`}><HardDrive size={18} /></div>
            <span className={styles.metricLabel}>Storage Used</span>
          </div>
          <div className={styles.metricValue}>
            {formatFileSize(storageStats.serverStorageUsed || storageStats.totalUsed)}
          </div>
          <div className={styles.metricFooter}>
            <span>DB: {formatFileSize(storageStats.totalUsed)}</span>
          </div>
        </button>

        <button className={styles.metricCard} onClick={() => navigate("/admin/files")}>
          <div className={styles.metricHeader}>
            <div className={`${styles.metricIconWrap} ${styles.iconPurple}`}><FolderOpen size={18} /></div>
            <span className={styles.metricLabel}>Folders</span>
          </div>
          <div className={styles.metricValue}>{fileStats.folders ?? 0}</div>
          <div className={styles.metricFooter}><span>Across all users</span></div>
        </button>

        <button className={styles.metricCard} onClick={() => navigate("/admin/activity")}>
          <div className={styles.metricHeader}>
            <div className={`${styles.metricIconWrap} ${styles.iconCyan}`}><Activity size={18} /></div>
            <span className={styles.metricLabel}>Active Uploads</span>
          </div>
          <div className={styles.metricValue}>{activeUploads}</div>
          <div className={styles.metricFooter}><span>In progress right now</span></div>
        </button>
      </div>

      {/* Charts grid */}
      {prefsLoading ? (
        <div className={styles.centeredState}><LoadingSpinner /></div>
      ) : visibleWidgets.length === 0 ? (
        <div className={styles.emptyState}>
          <Settings size={40} />
          <h3>No widgets visible</h3>
          <p>
            Click{" "}
            <button className={styles.inlineBtn} onClick={() => setShowCustomizer(true)}>
              Customize
            </button>{" "}
            to enable widgets.
          </p>
        </div>
      ) : (
        <div className={styles.chartsGrid}>
          {isWidgetVisible("storageCapacity") && (
            <div className={styles.gridItem}>
              <StorageCapacityGauge storageStats={storageStats} />
            </div>
          )}

          {isWidgetVisible("userDistribution") && (
            <div className={styles.gridItem}>
              <UserDistributionChart userStats={userStats} />
            </div>
          )}

          {isWidgetVisible("topFileTypes") && (
            <div className={styles.gridItem}>
              <TopFileTypesChart fileTypes={fileTypes} getFileTypeLabel={getFileTypeLabel} />
            </div>
          )}

          {isWidgetVisible("storageTrend") && (
            <div className={`${styles.gridItem} ${styles.gridItemWide}`}>
              <StorageTrendChart storageTrendData={storageTrendData} />
            </div>
          )}

          {isWidgetVisible("topStorageUsers") && (
            <div className={styles.gridItem}>
              <TopStorageUsersChart storageByUserData={storageByUserData} />
            </div>
          )}

          {isWidgetVisible("fileSizeDistribution") && (
            <div className={styles.gridItem}>
              <FileSizeDistributionChart fileSizeDistribution={fileSizeDistribution} />
            </div>
          )}

          {isWidgetVisible("activityTimeline") && (
            <div className={`${styles.gridItem} ${styles.gridItemWide}`}>
              <ActivityTimelineChart activityTimelineData={activityTimelineData} />
            </div>
          )}

          {isWidgetVisible("storageByFileType") && (
            <div className={styles.gridItem}>
              <StorageByFileTypeChart storageByFileTypeData={storageByFileTypeData} />
            </div>
          )}

          {isWidgetVisible("userGrowthTrend") && systemStats?.userGrowthTrend && (
            <div className={`${styles.gridItem} ${styles.gridItemWide}`}>
              <UserGrowthTrendChart userGrowthData={systemStats.userGrowthTrend} />
            </div>
          )}

          {isWidgetVisible("uploadPatternsByHour") && systemStats?.uploadPatternsByHour && (
            <div className={`${styles.gridItem} ${styles.gridItemWide}`}>
              <UploadPatternsByHourChart uploadPatternData={systemStats.uploadPatternsByHour} />
            </div>
          )}

          {isWidgetVisible("storageByRole") && systemStats?.storageByRole && (
            <div className={styles.gridItem}>
              <StorageByRoleChart storageByRoleData={systemStats.storageByRole} />
            </div>
          )}

          {isWidgetVisible("trashStatistics") && (
            <div className={styles.gridItem}>
              <TrashStatisticsChart fileStats={fileStats} storageStats={storageStats} />
            </div>
          )}

          {isWidgetVisible("avgFileSizeByType") && systemStats?.avgFileSizeByType && (
            <div className={styles.gridItem}>
              <AverageFileSizeByTypeChart
                avgFileSizeData={systemStats.avgFileSizeByType}
                getFileTypeLabel={getFileTypeLabel}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
