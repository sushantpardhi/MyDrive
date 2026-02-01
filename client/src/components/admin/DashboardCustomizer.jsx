import React, { useState, useEffect } from "react";
import { X, Check, RotateCcw, Settings } from "lucide-react";
import { toast } from "react-toastify";
import styles from "./DashboardCustomizer.module.css";

// All available widgets with their metadata
export const AVAILABLE_WIDGETS = [
  {
    id: "storageCapacity",
    name: "Storage Capacity",
    description: "Gauge showing total storage used",
    category: "storage",
  },
  {
    id: "userDistribution",
    name: "User Distribution",
    description: "Users by role (Admin, Family, Guest)",
    category: "users",
  },
  {
    id: "topFileTypes",
    name: "Top File Types",
    description: "Most common file types",
    category: "files",
  },
  {
    id: "storageTrend",
    name: "Storage Trend",
    description: "Storage usage over 30 days",
    category: "storage",
  },
  {
    id: "topStorageUsers",
    name: "Top Storage Users",
    description: "Users using most storage",
    category: "users",
  },
  {
    id: "fileSizeDistribution",
    name: "File Size Distribution",
    description: "Distribution of file sizes",
    category: "files",
  },
  {
    id: "activityTimeline",
    name: "Activity Timeline",
    description: "Uploads and registrations over time",
    category: "activity",
  },
  {
    id: "storageByFileType",
    name: "Storage by File Type",
    description: "Storage breakdown by file type",
    category: "storage",
  },
  {
    id: "userGrowthTrend",
    name: "User Growth Trend",
    description: "User registration trend over 30 days",
    category: "users",
  },
  {
    id: "uploadPatternsByHour",
    name: "Upload Patterns",
    description: "Hourly upload patterns",
    category: "activity",
  },
  {
    id: "storageByRole",
    name: "Storage by Role",
    description: "Storage usage by user role",
    category: "storage",
  },
  {
    id: "trashStatistics",
    name: "Trash Statistics",
    description: "Trash usage and statistics",
    category: "files",
  },
  {
    id: "avgFileSizeByType",
    name: "Avg File Size by Type",
    description: "Average file sizes by type",
    category: "files",
  },
];

// Default visible widgets (all of them)
export const DEFAULT_VISIBLE_WIDGETS = AVAILABLE_WIDGETS.map((w) => w.id);

const DashboardCustomizer = ({
  isOpen,
  onClose,
  currentPreferences,
  onSave,
}) => {
  const [selectedWidgets, setSelectedWidgets] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize with current preferences or defaults
      const visible =
        currentPreferences?.visibleWidgets || DEFAULT_VISIBLE_WIDGETS;
      setSelectedWidgets([...visible]);
    }
  }, [isOpen, currentPreferences]);

  const handleToggleWidget = (widgetId) => {
    setSelectedWidgets((prev) => {
      if (prev.includes(widgetId)) {
        return prev.filter((id) => id !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedWidgets([...DEFAULT_VISIBLE_WIDGETS]);
  };

  const handleClearAll = () => {
    setSelectedWidgets([]);
  };

  const handleReset = () => {
    setSelectedWidgets([...DEFAULT_VISIBLE_WIDGETS]);
  };

  const handleSave = async () => {
    if (selectedWidgets.length === 0) {
      toast.warning("Please select at least one widget");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        visibleWidgets: selectedWidgets,
        widgetOrder: currentPreferences?.widgetOrder || null, // Preserve existing layout
      });
      toast.success("Dashboard preferences saved");
      onClose();
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const groupedWidgets = {
    storage: AVAILABLE_WIDGETS.filter((w) => w.category === "storage"),
    users: AVAILABLE_WIDGETS.filter((w) => w.category === "users"),
    files: AVAILABLE_WIDGETS.filter((w) => w.category === "files"),
    activity: AVAILABLE_WIDGETS.filter((w) => w.category === "activity"),
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <Settings size={20} className={styles.titleIcon} />
            <h2 className={styles.title}>Customize Dashboard</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Select which widgets to display on your dashboard. Changes will be
            saved and persist across sessions.
          </p>

          <div className={styles.actions}>
            <button className={styles.actionButton} onClick={handleSelectAll}>
              Select All
            </button>
            <button className={styles.actionButton} onClick={handleClearAll}>
              Clear All
            </button>
            <button className={styles.actionButton} onClick={handleReset}>
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className={styles.widgetGroups}>
            {Object.entries(groupedWidgets).map(([category, widgets]) => (
              <div key={category} className={styles.widgetGroup}>
                <h3 className={styles.groupTitle}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h3>
                <div className={styles.widgetList}>
                  {widgets.map((widget) => (
                    <label key={widget.id} className={styles.widgetItem}>
                      <input
                        type="checkbox"
                        checked={selectedWidgets.includes(widget.id)}
                        onChange={() => handleToggleWidget(widget.id)}
                        className={styles.checkbox}
                      />
                      <div className={styles.widgetInfo}>
                        <span className={styles.widgetName}>{widget.name}</span>
                        <span className={styles.widgetDescription}>
                          {widget.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.selectedCount}>
            {selectedWidgets.length} of {AVAILABLE_WIDGETS.length} selected
          </span>
          <div className={styles.footerButtons}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={saving || selectedWidgets.length === 0}
            >
              <Check size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCustomizer;
