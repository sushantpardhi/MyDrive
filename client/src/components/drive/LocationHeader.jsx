import { useState, useRef, useEffect } from "react";
import { Share2, Trash2, Grid, List, CheckSquare, ChevronRight, Home, Folder, MoreHorizontal } from "lucide-react";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./LocationHeader.module.css";

const LocationHeader = ({
  type,
  locationName,
  viewMode,
  setViewMode,
  allItemIds,
  onSelectAll,
  path,
  navigateTo,
  breadcrumbRef,
}) => {
  const { selectedItems } = useSelectionContext();
  const [showDropdown, setShowDropdown] = useState(false);
  const [collapsedItems, setCollapsedItems] = useState([]);
  const dropdownRef = useRef(null);

  const getLocationIcon = () => {
    switch (type) {
      case "shared":
        return <Share2 size={22} />;
      case "trash":
        return <Trash2 size={22} />;
      default:
        return <Grid size={22} />;
    }
  };

  const allSelected =
    allItemIds.length > 0 && allItemIds.every((id) => selectedItems.has(id));

  // Determine if we should collapse the breadcrumb (more than 4 items)
  const shouldCollapse = path.length > 4;

  useEffect(() => {
    if (shouldCollapse) {
      // Show first, ellipsis, and last 2
      setCollapsedItems(path.slice(1, -2));
    } else {
      setCollapsedItems([]);
    }
  }, [path, shouldCollapse]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleDropdownItemClick = (item, index) => {
    const actualIndex = path.findIndex((p) => p.id === item.id);
    navigateTo(actualIndex);
    setShowDropdown(false);
  };

  const renderBreadcrumbItems = () => {
    if (!shouldCollapse) {
      return path.map((p, i) => renderBreadcrumbItem(p, i, false));
    }

    // Collapsed view: First item, ellipsis, last 2 items
    const items = [];
    
    // First item (root)
    items.push(renderBreadcrumbItem(path[0], 0, false));

    // Ellipsis dropdown
    if (collapsedItems.length > 0) {
      items.push(
        <span key="ellipsis-wrapper" className={styles.breadcrumbItem}>
          <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button
              className={`${styles.breadcrumbLink} ${styles.ellipsisButton}`}
              onClick={() => setShowDropdown(!showDropdown)}
              aria-label="Show hidden folders"
              title="Show hidden folders"
            >
              <MoreHorizontal size={16} />
            </button>
            {showDropdown && (
              <div className={styles.dropdown}>
                {collapsedItems.map((item, idx) => (
                  <button
                    key={item.id}
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick(item, idx)}
                  >
                    <Folder size={14} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ChevronRight size={16} className={styles.separator} />
        </span>
      );
    }

    // Last 2 items
    const lastItems = path.slice(-2);
    lastItems.forEach((p, i) => {
      const actualIndex = path.length - 2 + i;
      items.push(renderBreadcrumbItem(p, actualIndex, false));
    });

    return items;
  };

  const renderBreadcrumbItem = (p, i, isLast = i === path.length - 1) => {
    const Icon = i === 0 ? Home : Folder;
    const isCurrent = i === path.length - 1;

    return (
      <span
        key={p.id}
        className={`${styles.breadcrumbItem} ${styles[`item-${i}`]}`}
        style={{ animationDelay: `${i * 0.05}s` }}
      >
        <button
          onClick={() => navigateTo(i)}
          className={`${styles.breadcrumbLink} ${
            isCurrent ? styles.breadcrumbCurrent : ""
          }`}
          title={p.name}
          aria-label={`Navigate to ${p.name}`}
        >
          {isCurrent && <span className={styles.gradientBg} />}
          <Icon size={i === 0 ? 16 : 14} className={styles.breadcrumbIcon} />
          <span className={styles.breadcrumbText}>{p.name}</span>
        </button>
        {!isCurrent && (
          <ChevronRight size={16} className={styles.separator} />
        )}
      </span>
    );
  };

  return (
    <div className={styles.locationHeader}>
      <div className={styles.breadcrumbScroll} ref={breadcrumbRef}>
        {renderBreadcrumbItems()}
      </div>
      <div className={styles.locationControls}>
        <button
          className={`${styles.controlBtn} ${allSelected ? styles.active : ""}`}
          onClick={onSelectAll}
          title="Select all"
          aria-label="Select all items"
        >
          <CheckSquare size={18} />
        </button>
        <button
          className={`${styles.controlBtn} ${
            viewMode === "grid" ? styles.active : ""
          }`}
          onClick={() => setViewMode("grid")}
          aria-label="Grid view"
          title="Grid view"
        >
          <Grid size={18} />
        </button>
        <button
          className={`${styles.controlBtn} ${
            viewMode === "list" ? styles.active : ""
          }`}
          onClick={() => setViewMode("list")}
          aria-label="List view"
          title="List view"
        >
          <List size={18} />
        </button>
      </div>
    </div>
  );
};

export default LocationHeader;
