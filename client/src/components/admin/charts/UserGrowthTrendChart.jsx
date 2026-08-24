import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import EmptyChartState from "./EmptyChartState";
import styles from "./ChartCard.module.css";

const UserGrowthTrendChart = ({ userGrowthData }) => {
  const [graphType, setGraphType] = useState("line");
  const chartData = Array.isArray(userGrowthData) ? userGrowthData : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="User Growth Trend (30 Days)"
        message="No user growth data available."
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
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="admin"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
                name="Admin"
              />
              <Area
                type="monotone"
                dataKey="family"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Family"
              />
              <Area
                type="monotone"
                dataKey="guest"
                stackId="1"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.6}
                name="Guest"
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
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <Bar dataKey="admin" stackId="a" fill="#10b981" name="Admin" />
              <Bar dataKey="family" stackId="a" fill="#3b82f6" name="Family" />
              <Bar dataKey="guest" stackId="a" fill="#f59e0b" name="Guest" />
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
                    Admin
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Family
                  </th>
                  <th className={styles.tableHeaderRight}>
                    Guest
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCell}>{entry.date}</td>
                    <td className={styles.tableCellRight}>
                      {entry.admin || 0}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.family || 0}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.guest || 0}
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
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#1f2937",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="admin"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Admin"
              />
              <Line
                type="monotone"
                dataKey="family"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Family"
              />
              <Line
                type="monotone"
                dataKey="guest"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Guest"
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>User Growth Trend (30 Days)</h3>
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

export default UserGrowthTrendChart;
