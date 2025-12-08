import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronLeft,
  Upload,
  UserPlus,
  FileText,
  Users,
  TrendingUp,
  Clock,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useAdmin, useAuth } from "../../contexts";
import { formatFileSize, formatDate } from "../../utils/formatters";
import logger from "../../utils/logger";
import styles from "./ActivityLog.module.css";

const ActivityLog = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { activity, loading, fetchActivity } = useAdmin();
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/drive");
      return;
    }
    loadActivity();
  }, [currentUser]);

  const loadActivity = async () => {
    try {
      await fetchActivity({ limit: 100 });
    } catch (error) {
      logger.error("Failed to load activity log", { error: error.message });
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "file_upload":
        return <Upload size={20} color="#4caf50" />;
      case "user_registration":
        return <UserPlus size={20} color="#2196f3" />;
      default:
        return <FileText size={20} color="#9e9e9e" />;
    }
  };

  const getActivityTypeLabel = (type) => {
    switch (type) {
      case "file_upload":
        return "File Upload";
      case "user_registration":
        return "User Registration";
      default:
        return "Unknown";
    }
  };

  const getActivityTypeBadgeClass = (type) => {
    switch (type) {
      case "file_upload":
        return styles.badgeUpload;
      case "user_registration":
        return styles.badgeRegistration;
      default:
        return styles.badgeDefault;
    }
  };

  const formatActivityDate = (timestamp) => {
    if (!timestamp) {
      logger.debug("formatActivityDate: No timestamp provided");
      return "N/A";
    }

    try {
      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        logger.warn("formatActivityDate: Invalid date", { timestamp });
        return "Invalid Date";
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      logger.error("formatActivityDate: Error formatting date", {
        timestamp,
        error: error.message,
      });
      return "Invalid Date";
    }
  };

  const renderActivityDetails = (activityItem) => {
    switch (activityItem.type) {
      case "file_upload":
        return (
          <>
            <div className={styles.activityTitle}>
              <strong>{activityItem.user?.name}</strong> uploaded a file
            </div>
            <div className={styles.activityDetails}>
              {activityItem.details.fileName} •{" "}
              {formatFileSize(activityItem.details.fileSize)}
            </div>
          </>
        );
      case "user_registration":
        return (
          <>
            <div className={styles.activityTitle}>
              New user registered:{" "}
              <strong>{activityItem.details.userName}</strong>
            </div>
            <div className={styles.activityDetails}>
              {activityItem.details.userEmail} • Role:{" "}
              {activityItem.details.userRole}
            </div>
          </>
        );
      default:
        return <div className={styles.activityTitle}>Unknown activity</div>;
    }
  };

  const allActivities = useMemo(() => {
    const activities = [];
    if (activity) {
      if (activity.recentUploads) {
        activities.push(...activity.recentUploads);
      }
      if (activity.recentRegistrations) {
        activities.push(...activity.recentRegistrations);
      }
    }

    // Debug logging
    if (activities.length > 0) {
      logger.debug("Activity data sample", {
        sampleActivity: activities[0],
        timestamp: activities[0]?.timestamp,
        timestampType: typeof activities[0]?.timestamp,
      });
    }

    // Sort by timestamp descending
    return activities.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [activity]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filterType === "all") return allActivities;
    return allActivities.filter((item) => item.type === filterType);
  }, [allActivities, filterType]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const uploads = allActivities.filter((a) => a.type === "file_upload");
    const registrations = allActivities.filter(
      (a) => a.type === "user_registration"
    );
    const totalSize = uploads.reduce(
      (sum, a) => sum + (a.details?.fileSize || 0),
      0
    );

    return {
      totalActivities: allActivities.length,
      uploads: uploads.length,
      registrations: registrations.length,
      totalUploadSize: totalSize,
    };
  }, [allActivities]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Activity size={28} />
            Activity Log
          </h1>
          <p className={styles.subtitle}>Recent system activity and events</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionButton}
            onClick={() => loadActivity()}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            className={styles.backButton}
            onClick={() => navigate("/admin")}
          >
            <ChevronLeft size={18} />
            Back
          </button>
        </div>
      </div>

      {loading && !activity ? (
        <div className={styles.loading}>Loading activity log...</div>
      ) : !activity || allActivities.length === 0 ? (
        <div className={styles.empty}>No recent activity</div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#e3f2fd" }}
              >
                <Activity size={24} color="#1976d2" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {statistics.totalActivities}
                </div>
                <div className={styles.statLabel}>Total Activities</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#e8f5e9" }}
              >
                <Upload size={24} color="#388e3c" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{statistics.uploads}</div>
                <div className={styles.statLabel}>File Uploads</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#f3e5f5" }}
              >
                <UserPlus size={24} color="#7b1fa2" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {statistics.registrations}
                </div>
                <div className={styles.statLabel}>New Users</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#fff3e0" }}
              >
                <TrendingUp size={24} color="#f57c00" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {formatFileSize(statistics.totalUploadSize)}
                </div>
                <div className={styles.statLabel}>Total Uploaded</div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className={styles.controls}>
            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <Filter size={16} />
                <select
                  className={styles.filterSelect}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Activities</option>
                  <option value="file_upload">File Uploads</option>
                  <option value="user_registration">User Registrations</option>
                </select>
              </div>
            </div>
          </div>

          {/* Activity Table */}
          {filteredActivities.length === 0 ? (
            <div className={styles.empty}>No activities found</div>
          ) : (
            <div className={styles.tableWrapper}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>User</th>
                      <th>Details</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <div className={styles.typeCell}>
                            <div className={styles.typeIcon}>
                              {getActivityIcon(item.type)}
                            </div>
                            <span
                              className={`${
                                styles.typeBadge
                              } ${getActivityTypeBadgeClass(item.type)}`}
                            >
                              {getActivityTypeLabel(item.type)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            {item.type === "file_upload" && (
                              <>
                                <div className={styles.userName}>
                                  {item.user?.name || "Unknown User"}
                                </div>
                                <div className={styles.userEmail}>
                                  {item.user?.email || "N/A"}
                                </div>
                              </>
                            )}
                            {item.type === "user_registration" && (
                              <>
                                <div className={styles.userName}>
                                  {item.details?.userName || "Unknown User"}
                                </div>
                                <div className={styles.userEmail}>
                                  {item.details?.userEmail || "N/A"}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.detailsCell}>
                            {item.type === "file_upload" && (
                              <>
                                <div className={styles.detailsMain}>
                                  {item.details?.fileName || "Unknown file"}
                                </div>
                                <div className={styles.detailsSub}>
                                  {formatFileSize(item.details?.fileSize || 0)}
                                </div>
                              </>
                            )}
                            {item.type === "user_registration" && (
                              <>
                                <div className={styles.detailsMain}>
                                  Role: {item.details?.userRole || "N/A"}
                                </div>
                                <div className={styles.detailsSub}>
                                  New account created
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.dateCell}>
                            {formatActivityDate(item.timestamp)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActivityLog;
