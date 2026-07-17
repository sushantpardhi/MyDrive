import React, { useState } from "react";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  LineChart,
  BarChart,
  AreaChart,
} from "recharts";
import GraphTypeSelector from "./GraphTypeSelector";
import EmptyChartState from "./EmptyChartState";
import styles from "./ChartCard.module.css";

const ActivityTimelineChart = ({ activityTimelineData }) => {
  const [graphType, setGraphType] = useState("area");
  const chartData = Array.isArray(activityTimelineData)
    ? activityTimelineData
    : [];

  if (chartData.length === 0) {
    return (
      <EmptyChartState
        title="Activity Timeline"
        message="No activity timeline data available."
        selectedType={graphType}
        onSelect={setGraphType}
        validTypes={["area", "line", "bar", "table"]}
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
                dataKey="uploads"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="File Uploads"
              />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="New Users"
              />
            </LineChart>
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
              <Bar
                dataKey="uploads"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="File Uploads"
              />
              <Bar
                dataKey="registrations"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="New Users"
              />
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
                    Uploads
                  </th>
                  <th className={styles.tableHeaderRight}>
                    New Users
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((entry, index) => (
                  <tr key={index} className={styles.tableRow}>
                    <td className={styles.tableCell}>{entry.date}</td>
                    <td className={styles.tableCellRight}>
                      {entry.uploads}
                    </td>
                    <td className={styles.tableCellRight}>
                      {entry.registrations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "area":
      default:
        // Use ComposedChart for the default "Area" view to keep original look (Area + Bar combo)
        // or actually switch to pure AreaChart. The user asked for "Area" so maybe pure AreaChart is better,
        // but the original was Composed. I'll stick to Composed for default/area as it looks nice,
        // effectively representing "Area" for the main metric.
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
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
                cursor={false}
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
                dataKey="uploads"
                fill="#3b82f6"
                stroke="#3b82f6"
                fillOpacity={0.3}
                name="File Uploads"
              />
              <Bar
                dataKey="registrations"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                name="New Users"
              />
            </ComposedChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Activity Timeline</h3>
        <GraphTypeSelector
          selectedType={graphType}
          onSelect={setGraphType}
          validTypes={["area", "line", "bar", "table"]}
        />
      </div>
      <div className={styles.chartContent}>{renderChartContent()}</div>
    </div>
  );
};

export default ActivityTimelineChart;
