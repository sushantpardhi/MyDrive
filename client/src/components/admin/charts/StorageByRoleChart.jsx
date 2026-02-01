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

  if (!storageByRoleData || storageByRoleData.length === 0) {
    return null;
  }

  // Calculate total for percentages
  const totalStorage = storageByRoleData.reduce(
    (acc, curr) => acc + curr.storage,
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
                data={storageByRoleData}
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
                {storageByRoleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      COLORS[entry.role.toLowerCase()] ||
                      COLORS[entry.role] ||
                      "#8b5cf6"
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatFileSize(value)} (${((value / totalStorage) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
              <Legend />
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
                    Role
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
                {storageByRoleData.map((entry, index) => (
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
                          backgroundColor: COLORS[entry.role] || "#8b5cf6",
                        }}
                      ></span>
                      {entry.role}
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
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={storageByRoleData}>
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
                {storageByRoleData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      COLORS[entry.role.toLowerCase()] ||
                      COLORS[entry.role] ||
                      "#8b5cf6"
                    }
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
