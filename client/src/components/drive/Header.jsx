import {
  Menu,
  Search,
  FolderPlus,
  Upload,
  Trash2,
  Share2,
  RotateCcw,
  Download,
  Copy,
  FolderInput,
  Clock,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useSelectionContext } from "../../contexts/SelectionContext";
import SearchFilters from "./SearchFilters";
import styles from "./Header.module.css";

const Header = ({
  onMenuClick,
  searchQuery,
  setSearchQuery,
  isSearching,
  clearSearch,
  type,
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
  onBulkCopy,
  onBulkMove,
  // Search filter props
  searchFilters,
  updateFilters,
  clearFilters,
  hasActiveFilters,
  searchHistory,
}) => {
  const { selectedItems } = useSelectionContext();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBarRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchBarRef.current &&
        !searchBarRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchFocus = () => {
    if (searchHistory && searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };
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

        {/* Action Buttons - Left Side */}
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

          {/* Selection Actions */}
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
                  <button onClick={onBulkCopy} className={styles.actionBtn}>
                    <Copy size={16} /> <span>Copy</span>
                  </button>
                  <button onClick={onBulkMove} className={styles.actionBtn}>
                    <FolderInput size={16} /> <span>Move</span>
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

        {/* Right Side - Search & Filters */}
        <div className={styles.searchContainer}>
          <div className={styles.searchBar} ref={searchBarRef}>
            <Search
              size={16}
              className={isSearching ? styles.searchIconActive : ""}
            />
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
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

            {/* Search Suggestions Dropdown */}
            {showSuggestions &&
              searchHistory &&
              searchHistory.length > 0 &&
              !searchQuery && (
                <div className={styles.searchSuggestions}>
                  <div className={styles.suggestionsHeader}>
                    <Clock size={14} />
                    <span>Recent Searches</span>
                  </div>
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <button
                      key={index}
                      className={styles.suggestionItem}
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <Clock size={14} />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Search Filters */}
          {searchFilters && (
            <div className={styles.searchFiltersWrapper}>
              <SearchFilters
                filters={searchFilters}
                onFiltersChange={updateFilters}
                onClear={clearFilters}
                isActive={hasActiveFilters}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
