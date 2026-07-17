import React from "react";
import GraphTypeSelector from "./GraphTypeSelector";
import styles from "./ChartCard.module.css";

const EmptyChartState = ({
  title,
  message,
  selectedType,
  onSelect,
  validTypes,
}) => {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>{title}</h3>
        <GraphTypeSelector
          selectedType={selectedType}
          onSelect={onSelect}
          validTypes={validTypes}
        />
      </div>
      <div
        className={styles.chartContent}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
        }}
      >
        {message}
      </div>
    </div>
  );
};

export default EmptyChartState;
