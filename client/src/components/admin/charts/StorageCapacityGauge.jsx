import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const StorageCapacityGauge = ({ storageStats, maxCapacity = 107374182400 }) => {
  // Default 100GB capacity
  const usedStorage = storageStats?.totalUsed || 0;
  const usedPercentage = (usedStorage / maxCapacity) * 100;
  const freeStorage = maxCapacity - usedStorage;

  // Determine status color
  let statusColor = "#10b981"; // green
  let statusIcon = CheckCircle;
  let statusText = "Healthy";

  if (usedPercentage >= 90) {
    statusColor = "#ef4444"; // red
    statusIcon = AlertCircle;
    statusText = "Critical";
  } else if (usedPercentage >= 75) {
    statusColor = "#f59e0b"; // orange
    statusIcon = AlertTriangle;
    statusText = "Warning";
  }

  const data = [
    { name: "Used", value: usedStorage, color: statusColor },
    { name: "Free", value: freeStorage, color: "#e5e7eb" },
  ];

  const StatusIcon = statusIcon;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Storage Capacity</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <StatusIcon size={16} color={statusColor} />
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: statusColor,
            }}
          >
            {statusText}
          </span>
        </div>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#1f2937",
              }}
              formatter={(value) => formatFileSize(value)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            textAlign: "center",
            marginTop: "-3rem",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
          }}
        >
          <div
            style={{ fontSize: "1.5rem", fontWeight: 600, color: statusColor }}
          >
            {usedPercentage.toFixed(1)}%
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            {formatFileSize(usedStorage)} / {formatFileSize(maxCapacity)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageCapacityGauge;
