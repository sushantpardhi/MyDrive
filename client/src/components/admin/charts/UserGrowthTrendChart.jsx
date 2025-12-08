import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import styles from "./ChartCard.module.css";

const UserGrowthTrendChart = ({ userGrowthData }) => {
  if (!userGrowthData || userGrowthData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>User Growth Trend (30 Days)</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={userGrowthData}>
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
            <Line
              type="monotone"
              dataKey="admin"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Admin"
            />
            <Line
              type="monotone"
              dataKey="family"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Family"
            />
            <Line
              type="monotone"
              dataKey="guest"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Guest"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UserGrowthTrendChart;
