import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import logger from "../../../utils/logger";
import styles from "./ChartCard.module.css";

const TopFileTypesChart = ({ fileTypes, getFileTypeLabel }) => {
  const fileTypeChartData =
    fileTypes && fileTypes.length > 0
      ? fileTypes.slice(0, 6).map((type, index) => {
          return {
            name: getFileTypeLabel(type._id),
            files: type.count || 0,
            size: type.totalSize || 0,
            color: [
              "#8b5cf6",
              "#ec4899",
              "#f59e0b",
              "#10b981",
              "#3b82f6",
              "#ef4444",
            ][index],
          };
        })
      : [];

  logger.debug("File type chart data", { fileTypeChartData });

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Top File Types</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={fileTypeChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
              }
              outerRadius={85}
              innerRadius={55}
              fill="#8884d8"
              dataKey="files"
            >
              {fileTypeChartData.map((entry, index) => (
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
      </div>
    </div>
  );
};

export default TopFileTypesChart;
