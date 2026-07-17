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
import styles from "./ChartCard.module.css";

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
];

const FileSizeDistributionChart = ({ fileSizeDistribution }) => {
  const [graphType, setGraphType] = useState("bar");
  const chartData = Array.isArray(fileSizeDistribution)
    ? fileSizeDistribution
    : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="File Size Distribution"
        message="No file size distribution data available."
        selectedType={graphType}
        onSelect={setGraphType}
        validTypes={["bar", "pie", "donut", "table"]}
      />
    );
  }

  // Calculate total for percentages
  const totalCount = chartData.reduce(
    (acc, curr) => acc + curr.count,
    0,
  );
  const getPercent = (value) =>
    totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : "0.0";

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
                dataKey="count"
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
                  `${value} files (${getPercent(value)}%)`,
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
                    Size Range
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
                      {entry.count}
                    </td>
                    <td className={styles.tableCellRight}>
                      {getPercent(entry.count)}%
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
                dataKey="name"
                stroke="var(--text-secondary)"
                fontSize={12}
              />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
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
        <h3 className={styles.chartTitle}>File Size Distribution</h3>
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

export default FileSizeDistributionChart;
