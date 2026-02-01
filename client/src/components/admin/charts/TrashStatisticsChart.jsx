import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Trash2 } from "lucide-react";
import GraphTypeSelector from "./GraphTypeSelector";
import styles from "./ChartCard.module.css";

const TrashStatisticsChart = ({ fileStats, storageStats }) => {
  const [graphType, setGraphType] = useState("pie");

  const activeFiles = fileStats?.total || 0;
  const trashedFiles = fileStats?.inTrash || 0;
  const totalFiles = activeFiles + trashedFiles;

  const data = [
    { name: "Active Files", value: activeFiles, color: "#10b981" },
    { name: "In Trash", value: trashedFiles, color: "#ef4444" },
  ];

  const trashedPercentage =
    totalFiles > 0 ? ((trashedFiles / totalFiles) * 100).toFixed(1) : 0;

  const renderChartContent = () => {
    switch (graphType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
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
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
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
                    Status
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
                {data.map((entry, index) => (
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
                          backgroundColor: entry.color,
                        }}
                      ></span>
                      {entry.name}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {entry.value}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {((entry.value / totalFiles) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "pie":
      case "donut":
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                outerRadius={85}
                innerRadius={graphType === "donut" ? 55 : 0}
                fill="#8884d8"
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 className={styles.chartTitle}>Trash Statistics</h3>
          <Trash2 size={18} color="var(--text-secondary)" />
        </div>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["pie", "donut", "bar", "table"]}
        />
      </div>
      <div className={styles.chartContent}>
        {renderChartContent()}
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "8px",
            fontSize: "0.875rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Files in Trash:
            </span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {trashedFiles} ({trashedPercentage}%)
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>Total Files:</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {totalFiles}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrashStatisticsChart;
