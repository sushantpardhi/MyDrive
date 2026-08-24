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
  const getPercent = (value) =>
    totalFiles > 0 ? ((value / totalFiles) * 100).toFixed(1) : "0.0";

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
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableHeaderLeft}>
                    Status
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
                {data.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCellWithDot}>
                      <span
                        className={styles.tableDot}
                        style={{ backgroundColor: entry.color }}
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className={styles.chartContent}>{renderChartContent()}</div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "8px",
            fontSize: "0.875rem",
            flexShrink: 0,
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
