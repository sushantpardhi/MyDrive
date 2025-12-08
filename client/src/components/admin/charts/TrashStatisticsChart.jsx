import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Trash2 } from "lucide-react";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const TrashStatisticsChart = ({ fileStats, storageStats }) => {
  const activeFiles = fileStats?.total || 0;
  const trashedFiles = fileStats?.inTrash || 0;
  const totalFiles = activeFiles + trashedFiles;

  const data = [
    { name: "Active Files", value: activeFiles, color: "#10b981" },
    { name: "In Trash", value: trashedFiles, color: "#ef4444" },
  ];

  const trashedPercentage =
    totalFiles > 0 ? ((trashedFiles / totalFiles) * 100).toFixed(1) : 0;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Trash Statistics</h3>
        <Trash2 size={18} color="var(--text-secondary)" />
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
              }
              outerRadius={85}
              innerRadius={55}
              fill="#8884d8"
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
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "8px",
            fontSize: "0.875rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Files in Trash:
            </span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {trashedFiles} ({trashedPercentage}%)
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>Total Files:</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {totalFiles}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrashStatisticsChart;
