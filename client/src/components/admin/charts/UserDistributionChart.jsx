import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import styles from "./ChartCard.module.css";

const COLORS = {
  Admin: "#10b981",
  Family: "#3b82f6",
  Guest: "#f59e0b",
  User: "#8b5cf6",
};

const UserDistributionChart = ({ userStats }) => {
  const [graphType, setGraphType] = useState("bar");

  const userRoleData = [
    { name: "Admin", value: userStats?.byRole?.admin || 0 },
    { name: "Family", value: userStats?.byRole?.family || 0 },
    { name: "Guest", value: userStats?.byRole?.guest || 0 },
  ];

  // Add User role if it exists in the data
  if (userStats?.byRole?.user) {
    userRoleData.push({ name: "User", value: userStats.byRole.user });
  }

  // Calculate total for percentages
  const total = userRoleData.reduce((acc, curr) => acc + curr.value, 0);
  const getPercent = (value) =>
    total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

  const renderChartContent = () => {
    switch (graphType) {
      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={userRoleData}
                cx="50%"
                cy="50%"
                innerRadius={graphType === "donut" ? 60 : 0}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {userRoleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name] || "#8b5cf6"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} (${getPercent(value)}%)`,
                  name,
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "table":
        return (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableHeaderLeft}>
                    Role
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Count
                  </th>
                  <th className={styles.tableHeaderRight}>
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {userRoleData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCellWithDot}>
                      <span
                        className={styles.tableDot}
                        style={{ backgroundColor: COLORS[entry.name] || "#8b5cf6" }}
                      ></span>
                      {entry.name}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.value}
                    </td>
                    <td className={styles.tableCellRight}>
                      {getPercent(entry.value)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "bar":
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userRoleData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                fontSize={12}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
                formatter={(value, name, props) => [value, props.payload.name]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {userRoleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name] || "#8b5cf6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>User Distribution</h3>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["bar", "pie", "donut", "table"]}
        />
      </div>
      <div className={styles.chartContent}>{renderChartContent()}</div>
    </div>
  );
};

export default UserDistributionChart;
