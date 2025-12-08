import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const AverageFileSizeByTypeChart = ({ averageFileSizeData }) => {
  if (!averageFileSizeData || averageFileSizeData.length === 0) {
    return null;
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Average File Size by Type</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={averageFileSizeData}>
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
            <Bar dataKey="avgSize" fill="#ec4899" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AverageFileSizeByTypeChart;
