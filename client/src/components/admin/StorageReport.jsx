import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardDrive,
  ChevronLeft,
  TrendingUp,
  AlertTriangle,
  Users,
  Database,
  RefreshCw,
} from "lucide-react";
import { useAdmin, useAuth } from "../../contexts";
import { formatFileSize } from "../../utils/formatters";
import { getUserInitials, getAvatarColor } from "../../utils/helpers";
import logger from "../../utils/logger";
import styles from "./StorageReport.module.css";

const StorageReport = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { storageReport, loading, fetchStorageReport } = useAdmin();

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/drive");
      return;
    }
    loadReport();
  }, [currentUser]);

  const loadReport = async () => {
    try {
      await fetchStorageReport();
    } catch (error) {
      logger.error("Failed to load storage report", { error: error.message });
    }
  };

  const getStorageBarColor = (percent) => {
    if (percent >= 90) return "#d32f2f";
    if (percent >= 75) return "#f57c00";
    if (percent >= 50) return "#fbc02d";
    return "#4caf50";
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!storageReport || !storageReport.users) {
      return {
        totalUsers: 0,
        totalStorage: 0,
        averageStorage: 0,
        usersNearLimit: 0,
      };
    }

    const totalStorage = storageReport.users.reduce(
      (sum, user) => sum + (user.storageUsed || 0),
      0
    );
    const usersNearLimit = storageReport.users.filter(
      (user) => user.storagePercent >= 80 && user.storageLimit !== -1
    ).length;

    return {
      totalUsers: storageReport.users.length,
      totalStorage,
      averageStorage: totalStorage / storageReport.users.length || 0,
      usersNearLimit,
    };
  }, [storageReport]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <HardDrive size={28} />
            Storage Report
          </h1>
          <p className={styles.subtitle}>User storage usage and distribution</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionButton}
            onClick={() => loadReport()}
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

      {loading && !storageReport ? (
        <div className={styles.loading}>Loading storage report...</div>
      ) : !storageReport ? (
        <div className={styles.error}>Failed to load storage report</div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#e3f2fd" }}
              >
                <Users size={24} color="#1976d2" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{statistics.totalUsers}</div>
                <div className={styles.statLabel}>Total Users</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#f3e5f5" }}
              >
                <Database size={24} color="#7b1fa2" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {formatFileSize(statistics.totalStorage)}
                </div>
                <div className={styles.statLabel}>Total Storage Used</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#e8f5e9" }}
              >
                <TrendingUp size={24} color="#388e3c" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {formatFileSize(statistics.averageStorage)}
                </div>
                <div className={styles.statLabel}>Avg per User</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div
                className={styles.statIcon}
                style={{ backgroundColor: "#fff3e0" }}
              >
                <AlertTriangle size={24} color="#f57c00" />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {statistics.usersNearLimit}
                </div>
                <div className={styles.statLabel}>Near Limit</div>
              </div>
            </div>
          </div>

          {/* User Storage Table */}
          {storageReport.users.length === 0 ? (
            <div className={styles.empty}>No users found</div>
          ) : (
            <div className={styles.tableWrapper}>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Storage Used</th>
                      <th>Storage Limit</th>
                      <th>Usage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageReport.users.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className={styles.userCell}>
                            <div
                              className={styles.userAvatar}
                              style={{
                                backgroundColor: getAvatarColor(user.name),
                              }}
                            >
                              {getUserInitials(user.name)}
                            </div>
                            <div className={styles.userInfo}>
                              <div className={styles.userName}>{user.name}</div>
                              <div className={styles.userEmail}>
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`${styles.roleBadge} ${
                              styles[`role${user.role}`]
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={styles.storageValue}>
                            {formatFileSize(user.storageUsed)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.storageValue}>
                            {user.storageLimit === -1
                              ? "Unlimited"
                              : formatFileSize(user.storageLimit)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.usageCell}>
                            {user.storageLimit !== -1 && (
                              <>
                                <div className={styles.usageText}>
                                  {user.storagePercent.toFixed(1)}%
                                </div>
                                <div className={styles.storageBar}>
                                  <div
                                    className={styles.storageBarFill}
                                    style={{
                                      width: `${Math.min(
                                        user.storagePercent,
                                        100
                                      )}%`,
                                      backgroundColor: getStorageBarColor(
                                        user.storagePercent
                                      ),
                                    }}
                                  />
                                </div>
                              </>
                            )}
                            {user.storageLimit === -1 && (
                              <span className={styles.unlimitedText}>N/A</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {user.storagePercent >= 90 &&
                          user.storageLimit !== -1 ? (
                            <div className={styles.statusWarning}>
                              <AlertTriangle size={16} />
                              Almost Full
                            </div>
                          ) : user.storagePercent >= 75 &&
                            user.storageLimit !== -1 ? (
                            <div className={styles.statusCaution}>
                              High Usage
                            </div>
                          ) : (
                            <div className={styles.statusNormal}>Normal</div>
                          )}
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

export default StorageReport;
