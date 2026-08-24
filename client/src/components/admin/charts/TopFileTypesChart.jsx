import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import logger from "../../../utils/logger";
import styles from "./ChartCard.module.css";
import { formatFileSize } from "../../../utils/formatters";

const TopFileTypesChart = ({ fileTypes, getFileTypeLabel }) => {
  const [graphType, setGraphType] = useState("pie");

  const fileTypeChartData =
    fileTypes && fileTypes.length > 0
      ? fileTypes.slice(0, 6).map((type, index) => {
          return {
            name: getFileTypeLabel(type._id),
            files: type.count || 0,
            size: type.totalSize || 0,
            color: [
              "#8b5cf6",
              "#ec4899",
              "#f59e0b",
              "#10b981",
              "#3b82f6",
              "#ef4444",
            ][index],
          };
        })
      : [];

  logger.debug("File type chart data", { fileTypeChartData });

  // Calculate total for percentages
  const totalFiles = fileTypeChartData.reduce(
    (acc, curr) => acc + curr.files,
    0,
  );
  const getPercent = (value) =>
    totalFiles > 0 ? ((value / totalFiles) * 100).toFixed(1) : "0.0";

  const renderChartContent = () => {
    switch (graphType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fileTypeChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                fontSize={11}
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
                formatter={(value, name) => [value, "Files"]}
              />
              <Bar dataKey="files" radius={[8, 8, 0, 0]}>
                {fileTypeChartData.map((entry, index) => (
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
                    Type
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Files
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Size
                  </th>
                  <th className={styles.tableHeaderRight}>
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {fileTypeChartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCellWithDot}>
                      <span
                        className={styles.tableDot}
                        style={{ backgroundColor: entry.color }}
                      ></span>
                      {entry.name}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.files}
                    </td>
                    <td className={styles.tableCellRight}>
                      {formatFileSize(entry.size)}
                    </td>
                    <td className={styles.tableCellRight}>
                      {getPercent(entry.files)}%
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
                data={fileTypeChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                outerRadius={85}
                innerRadius={graphType === "donut" ? 55 : 0}
                fill="#8884d8"
                dataKey="files"
                stroke="none"
                isAnimationActive={false}
              >
                {fileTypeChartData.map((entry, index) => (
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
                formatter={(value) => [value, "Files"]}
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
        <h3 className={styles.chartTitle}>Top File Types</h3>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["pie", "donut", "bar", "table"]}
        />
      </div>
      <div className={styles.chartContent}>{renderChartContent()}</div>
    </div>
  );
};

export default TopFileTypesChart;
