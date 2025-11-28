import {
  Menu,
  Search,
  FolderPlus,
  Upload,
  Trash2,
  Share2,
  RotateCcw,
  Download,
} from "lucide-react";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./Header.module.css";

const Header = ({
  onMenuClick,
  searchQuery,
  setSearchQuery,
  isSearching,
  clearSearch,
  path,
  navigateTo,
  type,
  breadcrumbRef,
  // Action props
  onCreateFolder,
  onFileUpload,
  onEmptyTrash,
  fileInputRef,
  // Selection Bar props
  onBulkDownload,
  onBulkShare,
  onBulkDelete,
  onBulkRestore,
}) => {
  const { selectedItems } = useSelectionContext();
  return (
    <div className={styles.headerContainer}>
      <div className={styles.headerBar}>
        <button
          className={styles.menuButton}
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>

        <div className={styles.searchBar}>
          <Search
            size={16}
            className={isSearching ? styles.searchIconActive : ""}
          />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className={styles.clearSearchBtn}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

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

        {/* Action Buttons or Selection Actions */}
        <div className={styles.actionButtons}>
          {selectedItems && selectedItems.size === 0 && (
            <>
              {type === "drive" && (
                <>
                  <button onClick={onCreateFolder} className={styles.actionBtn}>
                    <FolderPlus size={16} /> <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.actionBtn}
                  >
                    <Upload size={16} /> <span>Upload</span>
                  </button>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={onFileUpload}
                  />
                </>
              )}
              {type === "shared" && (
                <p className={styles.infoText}>Items shared with you</p>
              )}
              {type === "trash" && (
                <button
                  className={styles.actionBtnDanger}
                  onClick={onEmptyTrash}
                >
                  <Trash2 size={16} /> <span>Empty Trash</span>
                </button>
              )}
            </>
          )}

          {/* Selection Actions - same style as action buttons */}
          {selectedItems && selectedItems.size > 0 && (
            <>
              <span className={styles.selectionCount}>
                {selectedItems.size} selected
              </span>
              {type !== "trash" && (
                <>
                  <button onClick={onBulkDownload} className={styles.actionBtn}>
                    <Download size={16} /> <span>Download</span>
                  </button>
                  <button onClick={onBulkShare} className={styles.actionBtn}>
                    <Share2 size={16} /> <span>Share</span>
                  </button>
                  <button
                    onClick={onBulkDelete}
                    className={styles.actionBtnDanger}
                  >
                    <Trash2 size={16} /> <span>Delete</span>
                  </button>
                </>
              )}
              {type === "trash" && (
                <>
                  <button onClick={onBulkRestore} className={styles.actionBtn}>
                    <RotateCcw size={16} /> <span>Restore</span>
                  </button>
                  <button
                    onClick={onBulkDelete}
                    className={styles.actionBtnDanger}
                  >
                    <Trash2 size={16} /> <span>Delete</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
