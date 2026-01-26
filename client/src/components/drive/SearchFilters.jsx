import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Filter,
  X,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  File as FileIcon,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import styles from "./SearchFilters.module.css";

const SearchFilters = ({ filters, onFiltersChange, onClear, isActive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    fileTypes: [],
    sizeMin: "",
    sizeMax: "",
    dateStart: "",
    dateEnd: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [sizeMinUnit, setSizeMinUnit] = useState("bytes");
  const [sizeMaxUnit, setSizeMaxUnit] = useState("bytes");
  const [sizeMinDisplay, setSizeMinDisplay] = useState("");
  const [sizeMaxDisplay, setSizeMaxDisplay] = useState("");
  const filterContainerRef = useRef(null);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    
    checkMobile(); // Initial check
    
    // Add listener
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      // Fallback
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  // Close filter panel when clicking outside (Desktop only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterContainerRef.current &&
        !filterContainerRef.current.contains(event.target) &&
        isExpanded &&
        !isMobile // Only needed for desktop inline rendering
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded && !isMobile) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isExpanded, isMobile]);

  const fileTypeCategories = [
    { name: "Documents", icon: FileText, types: ["pdf", "doc", "docx", "txt"] },
    {
      name: "Images",
      icon: Image,
      types: ["jpg", "jpeg", "png", "gif", "svg", "webp"],
    },
    { name: "Videos", icon: Video, types: ["mp4", "avi", "mov", "mkv"] },
    { name: "Audio", icon: Music, types: ["mp3", "wav", "ogg", "m4a"] },
    { name: "Archives", icon: Archive, types: ["zip", "rar", "7z", "tar"] },
    {
      name: "Code",
      icon: Code,
      types: ["js", "jsx", "ts", "tsx", "py", "java", "cpp"],
    },
  ];

  const sizePresets = [
    { label: "Tiny (< 100 KB)", max: 102400 },
    { label: "Small (< 1 MB)", max: 1048576 },
    { label: "Medium (1-10 MB)", min: 1048576, max: 10485760 },
    { label: "Large (10-100 MB)", min: 10485760, max: 104857600 },
    { label: "Huge (> 100 MB)", min: 104857600 },
  ];

  const datePresets = [
    { label: "Today", days: 0 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "Last year", days: 365 },
  ];

  // Convert display value and unit to bytes
  const convertToBytes = (value, unit) => {
    if (!value || value === "") return "";
    const num = parseFloat(value);
    switch (unit) {
      case "kb":
        return Math.floor(num * 1024).toString();
      case "mb":
        return Math.floor(num * 1024 * 1024).toString();
      case "gb":
        return Math.floor(num * 1024 * 1024 * 1024).toString();
      case "bytes":
      default:
        return Math.floor(num).toString();
    }
  };

  // Convert bytes to display value in selected unit
  const convertFromBytes = (bytes, unit) => {
    if (!bytes || bytes === "") return "";
    const num = parseFloat(bytes);
    switch (unit) {
      case "kb":
        return (num / 1024).toFixed(2);
      case "mb":
        return (num / (1024 * 1024)).toFixed(2);
      case "gb":
        return (num / (1024 * 1024 * 1024)).toFixed(2);
      case "bytes":
      default:
        return num.toString();
    }
  };

  const handleFileTypeToggle = (types) => {
    const newTypes = localFilters.fileTypes.some((t) => types.includes(t))
      ? localFilters.fileTypes.filter((t) => !types.includes(t))
      : [...localFilters.fileTypes, ...types];

    const updated = { ...localFilters, fileTypes: [...new Set(newTypes)] };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleSizePreset = (preset) => {
    const updated = {
      ...localFilters,
      sizeMin: preset.min || "",
      sizeMax: preset.max || "",
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleDatePreset = (preset) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - preset.days);

    const updated = {
      ...localFilters,
      dateStart:
        preset.days === 0
          ? new Date().toISOString().split("T")[0]
          : startDate.toISOString().split("T")[0],
      dateEnd: endDate.toISOString().split("T")[0],
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleInputChange = (field, value) => {
    const updated = { ...localFilters, [field]: value };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleSizeMinChange = (value) => {
    setSizeMinDisplay(value);
    const bytes = convertToBytes(value, sizeMinUnit);
    const updated = { ...localFilters, sizeMin: bytes };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleSizeMaxChange = (value) => {
    setSizeMaxDisplay(value);
    const bytes = convertToBytes(value, sizeMaxUnit);
    const updated = { ...localFilters, sizeMax: bytes };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleSizeMinUnitChange = (unit) => {
    setSizeMinUnit(unit);
    if (sizeMinDisplay) {
      const bytes = convertToBytes(sizeMinDisplay, unit);
      const updated = { ...localFilters, sizeMin: bytes };
      setLocalFilters(updated);
      onFiltersChange(updated);
    }
  };

  const handleSizeMaxUnitChange = (unit) => {
    setSizeMaxUnit(unit);
    if (sizeMaxDisplay) {
      const bytes = convertToBytes(sizeMaxDisplay, unit);
      const updated = { ...localFilters, sizeMax: bytes };
      setLocalFilters(updated);
      onFiltersChange(updated);
    }
  };

  const handleClear = () => {
    const cleared = {
      fileTypes: [],
      sizeMin: "",
      sizeMax: "",
      dateStart: "",
      dateEnd: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    };
    setLocalFilters(cleared);
    setSizeMinDisplay("");
    setSizeMaxDisplay("");
    setSizeMinUnit("bytes");
    setSizeMaxUnit("bytes");
    onClear();
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.fileTypes.length > 0) count++;
    if (localFilters.sizeMin !== "" || localFilters.sizeMax !== "") count++;
    if (localFilters.dateStart !== "" || localFilters.dateEnd !== "") count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const renderFilterMenu = () => (
    <>
      {isMobile && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div className={styles.filterPanel}>
        <div className={styles.filterHeader}>
          <h3>Search Filters</h3>
          <div className={styles.filterActions}>
            <button onClick={handleClear} className={styles.clearBtn}>
              Clear All
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className={styles.closeBtn}
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.filterBody}>
          {/* File Type Filter */}
          <div className={styles.filterSection}>
            <h4>
              <Filter size={16} />
              File Type
            </h4>
            <div className={styles.typeGrid}>
              {fileTypeCategories.map((category) => {
                const Icon = category.icon;
                const isSelected = category.types.some((t) =>
                  localFilters.fileTypes.includes(t)
                );
                return (
                  <button
                    key={category.name}
                    className={`${styles.typeBtn} ${
                      isSelected ? styles.selected : ""
                    }`}
                    onClick={() => handleFileTypeToggle(category.types)}
                  >
                    <Icon size={20} />
                    <span>{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Filter */}
          <div className={styles.filterSection}>
            <h4>
              <Archive size={16} />
              File Size
            </h4>
            <div className={styles.presetButtons}>
              {sizePresets.map((preset) => (
                <button
                  key={preset.label}
                  className={styles.presetBtn}
                  onClick={() => handleSizePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.rangeInputs}>
              <div className={styles.inputGroup}>
                <label>Min Size</label>
                <div className={styles.sizeInputWrapper}>
                  <input
                    type="number"
                    placeholder="Value"
                    value={sizeMinDisplay}
                    onChange={(e) => handleSizeMinChange(e.target.value)}
                    className={styles.sizeInput}
                  />
                  <select
                    value={sizeMinUnit}
                    onChange={(e) => handleSizeMinUnitChange(e.target.value)}
                    className={styles.unitSelect}
                  >
                    <option value="bytes">Bytes</option>
                    <option value="kb">KB</option>
                    <option value="mb">MB</option>
                    <option value="gb">GB</option>
                  </select>
                </div>
                {localFilters.sizeMin && (
                  <span className={styles.inputHint}>
                    {formatBytes(parseInt(localFilters.sizeMin))}
                  </span>
                )}
              </div>
              <div className={styles.inputGroup}>
                <label>Max Size</label>
                <div className={styles.sizeInputWrapper}>
                  <input
                    type="number"
                    placeholder="Value"
                    value={sizeMaxDisplay}
                    onChange={(e) => handleSizeMaxChange(e.target.value)}
                    className={styles.sizeInput}
                  />
                  <select
                    value={sizeMaxUnit}
                    onChange={(e) => handleSizeMaxUnitChange(e.target.value)}
                    className={styles.unitSelect}
                  >
                    <option value="bytes">Bytes</option>
                    <option value="kb">KB</option>
                    <option value="mb">MB</option>
                    <option value="gb">GB</option>
                  </select>
                </div>
                {localFilters.sizeMax && (
                  <span className={styles.inputHint}>
                    {formatBytes(parseInt(localFilters.sizeMax))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Date Filter */}
          <div className={styles.filterSection}>
            <h4>
              <Calendar size={16} />
              Date Created
            </h4>
            <div className={styles.presetButtons}>
              {datePresets.map((preset) => (
                <button
                  key={preset.label}
                  className={styles.presetBtn}
                  onClick={() => handleDatePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.rangeInputs}>
              <div className={styles.inputGroup}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={localFilters.dateStart}
                  onChange={(e) =>
                    handleInputChange("dateStart", e.target.value)
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label>End Date</label>
                <input
                  type="date"
                  value={localFilters.dateEnd}
                  onChange={(e) =>
                    handleInputChange("dateEnd", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Sort Options */}
          <div className={styles.filterSection}>
            <h4>
              <ArrowUpDown size={16} />
              Sort By
            </h4>
            <div className={styles.sortControls}>
              <select
                value={localFilters.sortBy}
                onChange={(e) => handleInputChange("sortBy", e.target.value)}
                className={styles.sortSelect}
              >
                <option value="createdAt">Date Created</option>
                <option value="updatedAt">Date Modified</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
              <select
                value={localFilters.sortOrder}
                onChange={(e) =>
                  handleInputChange("sortOrder", e.target.value)
                }
                className={styles.sortSelect}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className={styles.filterContainer} ref={filterContainerRef}>
      <button
        className={`${styles.filterToggle} ${isActive ? styles.active : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Toggle search filters"
      >
        <Filter size={16} />
        <span>Filters</span>
        {isActive && <span className={styles.badge}>{activeCount}</span>}
      </button>

      {isExpanded &&
        (isMobile
          ? createPortal(renderFilterMenu(), document.body)
          : renderFilterMenu())}
    </div>
  );
};

export default SearchFilters;
