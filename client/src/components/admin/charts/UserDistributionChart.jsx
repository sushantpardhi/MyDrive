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

const UserDistributionChart = ({ userStats }) => {
  const userRoleData = [
    { name: "Admin", value: userStats?.byRole?.admin || 0, color: "#10b981" },
    { name: "Family", value: userStats?.byRole?.family || 0, color: "#3b82f6" },
    { name: "Guest", value: userStats?.byRole?.guest || 0, color: "#f59e0b" },
  ];

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>User Distribution</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={userRoleData}>
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
              itemStyle={{
                color: "#1f2937",
              }}
            />
            {userRoleData.map((entry, index) => (
              <Bar
                key={`bar-${index}`}
                dataKey="value"
                fill={entry.color}
                radius={[8, 8, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UserDistributionChart;
