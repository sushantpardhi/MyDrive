import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import EmptyChartState from "./EmptyChartState";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const COLORS = {
  admin: "#10b981",
  family: "#3b82f6",
  guest: "#f59e0b",
  user: "#8b5cf6",
};

const StorageByRoleChart = ({ storageByRoleData }) => {
  const [graphType, setGraphType] = useState("bar");
  const chartData = Array.isArray(storageByRoleData) ? storageByRoleData : [];
  const getRoleColor = (role) => {
    const normalizedRole = String(role || "").toLowerCase();
    return COLORS[normalizedRole] || "#8b5cf6";
  };

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="Storage Usage by Role"
        message="No storage-by-role data available."
        selectedType={graphType}
        onSelect={setGraphType}
        validTypes={["bar", "pie", "donut", "table"]}
      />
    );
  }

  // Calculate total for percentages
  const totalStorage = chartData.reduce(
    (acc, curr) => acc + curr.storage,
    0,
  );
  const getPercent = (value) =>
    totalStorage > 0 ? ((value / totalStorage) * 100).toFixed(1) : "0.0";

  const renderChartContent = () => {
    switch (graphType) {
      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={graphType === "donut" ? 60 : 0}
                outerRadius={80}
                paddingAngle={0}
                dataKey="storage"
                nameKey="role"
                stroke="none"
                isAnimationActive={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getRoleColor(entry.role)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatFileSize(value)} (${getPercent(value)}%)`,
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
                    Storage
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Files
                  </th>
                  <th className={styles.tableHeaderRight}>
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCellWithDot}>
                      <span
                        className={styles.tableDot}
                        style={{ backgroundColor: getRoleColor(entry.role) }}
                      ></span>
                      {entry.role}
                    </td>
                    <td className={styles.tableCellRight}>
                      {formatFileSize(entry.storage)}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.files}
                    </td>
                    <td className={styles.tableCellRight}>
                      {getPercent(entry.storage)}%
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
            <BarChart data={chartData}>
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
                cursor={false}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
                formatter={(value) => formatFileSize(value)}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <Bar dataKey="storage" radius={[8, 8, 0, 0]} name="Total Storage">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getRoleColor(entry.role)} />
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
        <h3 className={styles.chartTitle}>Storage Usage by Role</h3>
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

export default StorageByRoleChart;
