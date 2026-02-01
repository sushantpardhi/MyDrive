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

  if (!fileSizeDistribution || fileSizeDistribution.length === 0) {
    return null;
  }

  // Calculate total for percentages
  const totalCount = fileSizeDistribution.reduce(
    (acc, curr) => acc + curr.count,
    0,
  );

  const renderChartContent = () => {
    switch (graphType) {
      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={fileSizeDistribution}
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
                {fileSizeDistribution.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} files (${((value / totalCount) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case "table":
        return (
          <div
            className={styles.tableContainer}
            style={{ height: 280, overflowY: "auto" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Size Range
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Files
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {fileSizeDistribution.map((entry, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid var(--border-color-light)",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      ></span>
                      {entry.name}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {entry.count}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {((entry.count / totalCount) * 100).toFixed(1)}%
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
                cursor={false}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {fileSizeDistribution.map((entry, index) => (
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
