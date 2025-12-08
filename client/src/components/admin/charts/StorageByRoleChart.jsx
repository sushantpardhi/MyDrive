import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const StorageByRoleChart = ({ storageByRoleData }) => {
  if (!storageByRoleData || storageByRoleData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Storage Usage by Role</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={storageByRoleData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="role"
              stroke="var(--text-secondary)"
              fontSize={12}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={12}
              tickFormatter={(value) => formatFileSize(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#1f2937",
              }}
              formatter={(value) => formatFileSize(value)}
            />
            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
            <Bar
              dataKey="storage"
              fill="#8b5cf6"
              radius={[8, 8, 0, 0]}
              name="Total Storage"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StorageByRoleChart;
