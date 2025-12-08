import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const TopStorageUsersChart = ({ storageByUserData }) => {
  if (!storageByUserData || storageByUserData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Top Storage Users</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={storageByUserData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              type="number"
              stroke="var(--text-secondary)"
              fontSize={12}
              tickFormatter={(value) => formatFileSize(value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--text-secondary)"
              fontSize={12}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#1f2937",
              }}
              formatter={(value, name) => {
                if (name === "storage")
                  return [formatFileSize(value), "Storage"];
                return [value, "Files"];
              }}
            />
            <Bar dataKey="storage" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TopStorageUsersChart;
