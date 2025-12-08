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

const UploadPatternsByHourChart = ({ uploadPatternData }) => {
  if (!uploadPatternData || uploadPatternData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Upload Patterns by Hour</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={uploadPatternData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="hour"
              stroke="var(--text-secondary)"
              fontSize={12}
              label={{
                value: "Hour of Day",
                position: "insideBottom",
                offset: -5,
              }}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={12}
              label={{ value: "Uploads", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#1f2937",
              }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UploadPatternsByHourChart;
