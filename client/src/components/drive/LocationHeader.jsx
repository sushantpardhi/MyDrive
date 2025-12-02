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
  path,
  navigateTo,
  breadcrumbRef,
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
      <div className={styles.breadcrumbScroll} ref={breadcrumbRef}>
        {path.map((p, i) => (
          <span key={p.id} className={styles.breadcrumbItem}>
            <button
              onClick={() => navigateTo(i)}
              className={`${styles.breadcrumbLink} ${
                i === path.length - 1 ? styles.breadcrumbCurrent : ""
              }`}
              title={p.name}
              aria-label={`Navigate to ${p.name}`}
            >
              {i === 0 && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={styles.breadcrumbIcon}
                >
                  {type === "shared" ? (
                    <path
                      d="M16 5l6 6h-4v6h-4v-6h-4l6-6z"
                      fill="currentColor"
                    />
                  ) : type === "trash" ? (
                    <path
                      d="M3 6h18l-1.5 14H4.5L3 6zm2-3h14l1 3H4l1-3z"
                      fill="currentColor"
                    />
                  ) : (
                    <path
                      d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                      fill="currentColor"
                    />
                  )}
                </svg>
              )}
              {i > 0 && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={styles.breadcrumbIcon}
                >
                  <path
                    d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                    fill="currentColor"
                  />
                </svg>
              )}
              <span className={styles.breadcrumbText}>{p.name}</span>
            </button>
            {i < path.length - 1 && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={styles.separator}
              >
                <path
                  d="m9 18 6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            )}
          </span>
        ))}
      </div>
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
