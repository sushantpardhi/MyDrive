import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatFileSize } from "../../../utils/formatters";
import styles from "./ChartCard.module.css";

const StorageTrendChart = ({ storageTrendData }) => {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Storage Trend (30 Days)</h3>
      </div>
      <div className={styles.chartContent}>
        <ResponsiveContainer width="100%" height={280}>
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
      </div>
    </div>
  );
};

export default StorageTrendChart;
