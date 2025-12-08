import React from "react";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import styles from "./ChartCard.module.css";

const ActivityTimelineChart = ({ activityTimelineData }) => {
  if (!activityTimelineData || activityTimelineData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Activity Timeline</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={activityTimelineData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              fontSize={11}
              angle={-45}
              textAnchor="end"
              height={60}
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
            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
            <Area
              type="monotone"
              dataKey="uploads"
              fill="#3b82f6"
              stroke="#3b82f6"
              fillOpacity={0.3}
              name="File Uploads"
            />
            <Bar
              dataKey="registrations"
              fill="#10b981"
              radius={[8, 8, 0, 0]}
              name="New Users"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActivityTimelineChart;
