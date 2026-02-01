import React from "react";
import {
  BarChart2,
  PieChart,
  Activity,
  Table,
  LineChart,
  AreaChart,
} from "lucide-react";
import styles from "./ChartCard.module.css";

const GraphTypeSelector = ({ selectedType, onSelect, validTypes }) => {
  const icons = {
    bar: <BarChart2 size={16} />,
    pie: <PieChart size={16} />,
    donut: <PieChart size={16} />, // Reusing PieChart for Donut
    line: <LineChart size={16} />,
    area: <AreaChart size={16} />,
    table: <Table size={16} />,
  };

  const titles = {
    bar: "Bar Chart",
    pie: "Pie Chart",
    donut: "Donut Chart",
    line: "Line Chart",
    area: "Area Chart",
    table: "Table View",
  };

  return (
    <div className={styles.graphSelector}>
      {validTypes.map((type) => (
        <button
          key={type}
          className={`${styles.selectorButton} ${
            selectedType === type ? styles.active : ""
          }`}
          onClick={() => onSelect(type)}
          title={titles[type]}
        >
          {icons[type] || icons.bar}
        </button>
      ))}
    </div>
  );
};

export default GraphTypeSelector;
