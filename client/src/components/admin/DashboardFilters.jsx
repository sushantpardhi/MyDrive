import React, { useState, useEffect } from "react";
import { Filter, Calendar, X } from "lucide-react";
import styles from "./DashboardFilters.module.css";

const DATE_RANGES = [
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Today", value: "today" },
  { label: "Custom Range", value: "custom" },
  { label: "All Time", value: "all" },
];

const ROLES = [
  { label: "All Roles", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Family", value: "family" },
  { label: "User", value: "user" },
  { label: "Guest", value: "guest" },
];

const DashboardFilters = ({ filters, onFilterChange }) => {
  const [dateRange, setDateRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  // Initialize from props
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      // Check if it matches a preset
      const daysDiff = Math.round(
        (new Date(filters.endDate) - new Date(filters.startDate)) /
          (1000 * 60 * 60 * 24),
      );

      const isToday =
        new Date(filters.startDate).toDateString() ===
          new Date().toDateString() &&
        new Date(filters.endDate).toDateString() === new Date().toDateString();

      if (isToday) {
        setDateRange("today");
      } else if (daysDiff === 7) {
        setDateRange("7d");
      } else if (daysDiff === 30) {
        setDateRange("30d");
      } else {
        setDateRange("custom");
        setCustomStart(filters.startDate.split("T")[0]);
        setCustomEnd(filters.endDate.split("T")[0]);
      }
    } else {
      setDateRange("30d");
      // Default to 30d if no filters provided (or 'all' if that's the default logic)
      // But props might be empty on first load.
      // Actually AdminDashboard logic will determine defaults.
    }

    if (filters.role) {
      setSelectedRole(filters.role);
    }
  }, [filters]);

  const handleDateRangeChange = (e) => {
    const value = e.target.value;
    setDateRange(value);

    const end = new Date();
    let start = new Date();

    if (value === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      onFilterChange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        role: selectedRole,
      });
    } else if (value === "7d") {
      start.setDate(start.getDate() - 7);
      onFilterChange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        role: selectedRole,
      });
    } else if (value === "30d") {
      start.setDate(start.getDate() - 30);
      onFilterChange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        role: selectedRole,
      });
    } else if (value === "all") {
      onFilterChange({
        startDate: null,
        endDate: null,
        role: selectedRole,
      });
    } else {
      // Custom - wait for inputs
    }
  };

  const handleCustomDateChange = (type, value) => {
    if (type === "start") setCustomStart(value);
    else setCustomEnd(value);

    const start = type === "start" ? value : customStart;
    const end = type === "end" ? value : customEnd;

    if (start && end) {
      onFilterChange({
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        role: selectedRole,
      });
    }
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setSelectedRole(role);

    // Pass current date range values
    const currentFilters = { role };

    if (dateRange === "custom") {
      if (customStart && customEnd) {
        currentFilters.startDate = new Date(customStart).toISOString();
        currentFilters.endDate = new Date(customEnd).toISOString();
      }
    } else if (dateRange !== "all") {
      const end = new Date();
      let start = new Date();
      if (dateRange === "today") start.setHours(0, 0, 0, 0);
      else if (dateRange === "7d") start.setDate(start.getDate() - 7);
      else if (dateRange === "30d") start.setDate(start.getDate() - 30);

      currentFilters.startDate = start.toISOString();
      currentFilters.endDate = end.toISOString();
    }

    onFilterChange(currentFilters);
  };

  const handleReset = () => {
    setDateRange("30d");
    setSelectedRole("all");
    setCustomStart("");
    setCustomEnd("");

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    onFilterChange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      role: "all",
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.filterGroup}>
        <Calendar size={18} className={styles.icon} />
        <span className={styles.label}>Date Range:</span>
        <select
          className={styles.select}
          value={dateRange}
          onChange={handleDateRangeChange}
        >
          {DATE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {dateRange === "custom" && (
        <div className={styles.dateRangeInputs}>
          <input
            type="date"
            className={styles.dateInput}
            value={customStart}
            onChange={(e) => handleCustomDateChange("start", e.target.value)}
          />
          <span className={styles.separator}>to</span>
          <input
            type="date"
            className={styles.dateInput}
            value={customEnd}
            onChange={(e) => handleCustomDateChange("end", e.target.value)}
          />
        </div>
      )}

      <div className={styles.filterGroup}>
        <div className={styles.divider} />
        <Filter size={18} className={styles.icon} />
        <span className={styles.label}>Role:</span>
        <select
          className={styles.select}
          value={selectedRole}
          onChange={handleRoleChange}
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      <button className={styles.resetButton} onClick={handleReset}>
        <X size={16} />
        Reset Filters
      </button>
    </div>
  );
};

export default DashboardFilters;
