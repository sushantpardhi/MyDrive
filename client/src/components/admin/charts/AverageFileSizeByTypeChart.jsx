import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import EmptyChartState from "./EmptyChartState";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const AverageFileSizeByTypeChart = ({ averageFileSizeData }) => {
  const [graphType, setGraphType] = useState("bar");
  const chartData = Array.isArray(averageFileSizeData)
    ? averageFileSizeData
    : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="Average File Size by Type"
        message="No average file size data available."
        selectedType={graphType}
        onSelect={setGraphType}
        validTypes={["bar", "line", "area", "table"]}
      />
    );
  }

  const renderChartContent = () => {
    switch (graphType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="type"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={70}
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
                dataKey="avgSize"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Avg Size"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="type"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={70}
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
                dataKey="avgSize"
                stroke="#ec4899"
                fill="#ec4899"
                fillOpacity={0.3}
                name="Avg Size"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "table":
        return (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableHeaderLeft}>
                    Type
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Avg Size
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCell}>{entry.type}</td>
                    <td className={styles.tableCellRight}>
                      {formatFileSize(entry.avgSize)}
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
                dataKey="type"
                stroke="var(--text-secondary)"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={70}
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
              <Bar
                dataKey="avgSize"
                fill="#ec4899"
                radius={[8, 8, 0, 0]}
                name="Avg Size"
              />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Average File Size by Type</h3>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["bar", "line", "area", "table"]}
        />
      </div>
      <div className={styles.chartContent}>{renderChartContent()}</div>
    </div>
  );
};

export default AverageFileSizeByTypeChart;
