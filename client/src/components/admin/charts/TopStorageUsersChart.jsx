import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import EmptyChartState from "./EmptyChartState";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#ef4444",
];

const TopStorageUsersChart = ({ storageByUserData }) => {
  const [graphType, setGraphType] = useState("bar");
  const chartData = Array.isArray(storageByUserData) ? storageByUserData : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="Top Storage Users"
        message="No storage user data available."
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
                nameKey="name"
                stroke="none"
                isAnimationActive={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatFileSize(value)} (${getPercent(value)}%)`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
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
                    User
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
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></span>
                      {entry.name}
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
            <BarChart data={chartData} layout="vertical">
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
                cursor={false}
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
              <Bar dataKey="storage" fill="#8b5cf6" radius={[0, 8, 8, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
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
        <h3 className={styles.chartTitle}>Top Storage Users</h3>
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

export default TopStorageUsersChart;
