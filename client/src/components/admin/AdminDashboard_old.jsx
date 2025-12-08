import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Files,
  HardDrive,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useAdmin } from "../../contexts";
import { useAuth } from "../../contexts";
import { formatFileSize, formatDate } from "../../utils/formatters";
import logger from "../../utils/logger";
import styles from "./AdminDashboard.module.css";

// Minimal Donut Chart Component
const DonutChart = ({ data, total, centerText, size = 160 }) => {
  const radius = size / 2;
  const strokeWidth = 20;
  const innerRadius = radius - strokeWidth;
  const circumference = 2 * Math.PI * innerRadius;
  
  let currentAngle = -90;
  
  return (
    <div className={styles.chartWrapper}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={radius}
          cy={radius}
          r={innerRadius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;
          const x1 = radius + innerRadius * Math.cos((currentAngle * Math.PI) / 180);
          const y1 = radius + innerRadius * Math.sin((currentAngle * Math.PI) / 180);
          const endAngle = currentAngle + angle;
          const x2 = radius + innerRadius * Math.cos((endAngle * Math.PI) / 180);
          const y2 = radius + innerRadius * Math.sin((endAngle * Math.PI) / 180);
          const largeArc = angle > 180 ? 1 : 0;
          
          const path = [
            `M ${x1} ${y1}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
          ].join(' ');
          
          currentAngle = endAngle;
          
          return (
            <path
              key={index}
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        })}
        <text
          x={radius}
          y={radius}
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.chartCenterText}
        >
          {centerText}
        </text>
      </svg>
    </div>
  );
};

// Minimal Bar Chart Component
const BarChart = ({ data, maxValue }) => {
  return (
    <div className={styles.barChart}>
      {data.map((item, index) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div key={index} className={styles.barItem}>
            <div className={styles.barInfo}>
              <span className={styles.barLabel}>{item.label}</span>
              <span className={styles.barValue}>{item.displayValue}</span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color || 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { systemStats, loading, fetchSystemStats } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    logger.info("AdminDashboard mounted", { userId: user?.id });

    // Check if user is admin
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

  if (loading && !systemStats) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading admin dashboard...</div>
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
  } = systemStats;

  // Prepare chart data
  const userRoleData = [
    { label: 'Admin', value: userStats.byRole.admin || 0, color: '#4caf50' },
    { label: 'Family', value: userStats.byRole.family || 0, color: '#2196f3' },
    { label: 'Guest', value: userStats.byRole.guest || 0, color: '#ff9800' },
  ];

  const fileTypeChartData = fileTypes.slice(0, 5).map((type, index) => ({
    label: type._id || 'Unknown',
    value: type.count,
    displayValue: `${type.count} files`,
    color: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'][index],
  }));

  const maxFileTypeCount = Math.max(...fileTypeChartData.map(d => d.value));

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
        <div className={styles.metricCard}>
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

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Files size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Files</span>
          </div>
          <div className={styles.metricValue}>{fileStats.total}</div>
          <div className={styles.metricChange}>
            <span className={styles.metricSubtext}>{fileStats.inTrash} in trash</span>
          </div>
        </div>

        <div className={styles.metricCard}>
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

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Activity size={20} className={styles.metricIcon} />
            <span className={styles.metricLabel}>Activity</span>
          </div>
          <div className={styles.metricValue}>{activeUploads}</div>
          <div className={styles.metricChange}>
            <span className={styles.metricSubtext}>Active uploads</span>
          </div>
        </div>
      </div>      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        {/* User Distribution Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>User Distribution</h3>
          </div>
          <div className={styles.chartContent}>
            <DonutChart
              data={userRoleData}
              total={userStats.total}
              centerText={userStats.total}
              size={200}
            />
            <div className={styles.chartLegend}>
              {userRoleData.map((item, index) => (
                <div key={index} className={styles.legendItem}>
                  <div
                    className={styles.legendColor}
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={styles.legendLabel}>{item.label}</span>
                  <span className={styles.legendValue}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Storage & File Types */}
        <div className={styles.rightColumn}>

          {/* Storage Statistics */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <Database size={20} />
                Storage Overview
              </h2>
            </div>
            <div className={styles.storageGrid}>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Total Storage</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.totalUsed)}
                </div>
              </div>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Users Storage</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.userTotalUsed)}
                </div>
              </div>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Avg per User</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.userAverageUsed)}
                </div>
              </div>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Largest User</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.userMaxUsed)}
                </div>
              </div>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Avg File Size</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.averageFileSize)}
                </div>
              </div>
              <div className={styles.storageItem}>
                <div className={styles.storageLabel}>Largest File</div>
                <div className={styles.storageValue}>
                  {formatFileSize(storageStats.largestFile)}
                </div>
              </div>
            </div>
          </div>

          {/* File Type Distribution */}
          {fileTypes && fileTypes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <BarChart3 size={20} />
                  File Types
                </h2>
              </div>
              <div className={styles.fileTypesList}>
                {fileTypes.map((type, index) => (
                  <div key={index} className={styles.fileTypeItem}>
                    <div className={styles.fileTypeInfo}>
                      <div className={styles.fileTypeName}>
                        {type._id || "Unknown"}
                      </div>
                      <div className={styles.fileTypeStats}>
                        {type.count} files • {formatFileSize(type.totalSize)}
                      </div>
                    </div>
                    <div className={styles.fileTypeBar}>
                      <div
                        className={styles.fileTypeBarFill}
                        style={{
                          width: `${(type.count / fileStats.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
