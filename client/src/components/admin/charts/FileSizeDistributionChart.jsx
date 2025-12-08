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
import styles from "./ChartCard.module.css";

const FileSizeDistributionChart = ({ fileSizeDistribution }) => {
  if (!fileSizeDistribution || fileSizeDistribution.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>File Size Distribution</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={fileSizeDistribution}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="name"
              stroke="var(--text-secondary)"
              fontSize={12}
            />
            <YAxis stroke="var(--text-secondary)" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#1f2937",
              }}
            />
            <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FileSizeDistributionChart;
