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
import EmptyChartState from "./EmptyChartState";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const StorageTrendChart = ({ storageTrendData }) => {
  const [graphType, setGraphType] = useState("line");
  const chartData = Array.isArray(storageTrendData) ? storageTrendData : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="Storage Trend (30 Days)"
        message="No storage trend data available."
        selectedType={graphType}
        onSelect={setGraphType}
        validTypes={["line", "area", "bar", "table"]}
      />
    );
  }

  const renderChartContent = () => {
    switch (graphType) {
      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
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
            <BarChart data={chartData}>
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
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableHeaderLeft}>
                    Date
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Total Storage
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCell}>{entry.date}</td>
                    <td className={styles.tableCellRight}>
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
            <LineChart data={chartData}>
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
