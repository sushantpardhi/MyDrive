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

  if (!storageByUserData || storageByUserData.length === 0) {
    return null;
  }

  // Calculate total for percentages
  const totalStorage = storageByUserData.reduce(
    (acc, curr) => acc + curr.storage,
    0,
  );

  const renderChartContent = () => {
    switch (graphType) {
      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={storageByUserData}
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
                {storageByUserData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatFileSize(value)} (${((value / totalStorage) * 100).toFixed(1)}%)`,
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
            style={{ height: "100%", overflowY: "auto" }}
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
                    User
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Storage
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
                {storageByUserData.map((entry, index) => (
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
                      {formatFileSize(entry.storage)}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {entry.files}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {((entry.storage / totalStorage) * 100).toFixed(1)}%
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
            <BarChart data={storageByUserData} layout="vertical">
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
                {storageByUserData.map((entry, index) => (
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
