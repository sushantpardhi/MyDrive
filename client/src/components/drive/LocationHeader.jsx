import { Share2, Trash2, Grid, List, CheckSquare } from "lucide-react";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./LocationHeader.module.css";

const LocationHeader = ({
  type,
  locationName,
  viewMode,
  setViewMode,
  allItemIds,
  onSelectAll,
}) => {
  const { selectedItems } = useSelectionContext();
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

  return (
    <div className={styles.locationHeader}>
      <span className={styles.locationIcon}>{getLocationIcon()}</span>
      <span className={styles.locationName} title={locationName}>
        {locationName}
      </span>
      <div className={styles.locationControls}>
        <button
          className={`${styles.controlBtn} ${allSelected ? styles.active : ""}`}
          onClick={onSelectAll}
          title="Select all"
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
