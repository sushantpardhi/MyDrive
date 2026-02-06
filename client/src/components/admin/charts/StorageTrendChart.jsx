import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const StorageTrendChart = ({ storageTrendData }) => {
  const [graphType, setGraphType] = useState("line");

  const renderChartContent = () => {
    switch (graphType) {
      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={storageTrendData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickFormatter={(value) => formatFileSize(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
                formatter={(value) => formatFileSize(value)}
              />
              <Area
                type="monotone"
                dataKey="storage"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storageTrendData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickFormatter={(value) => formatFileSize(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
                formatter={(value) => formatFileSize(value)}
              />
              <Bar dataKey="storage" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Total Storage
                  </th>
                </tr>
              </thead>
              <tbody>
                {storageTrendData.map((entry, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid var(--border-color-light)",
                    }}
                  >
                    <td style={{ padding: "8px" }}>{entry.date}</td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {formatFileSize(entry.storage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "line":
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={storageTrendData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickFormatter={(value) => formatFileSize(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
                formatter={(value) => formatFileSize(value)}
              />
              <Line
                type="monotone"
                dataKey="storage"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Storage Trend (30 Days)</h3>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["line", "area", "bar", "table"]}
        />
      </div>
      <div className={styles.chartContent}>{renderChartContent()}</div>
    </div>
  );
};

export default StorageTrendChart;
