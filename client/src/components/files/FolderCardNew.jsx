import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./FolderCardNew.module.css";
import {
  Folder,
  Share2,
  Trash2,
  MoreVertical,
  CheckSquare,
  Square,
  RotateCcw,
  Edit3,
  Copy,
  Move,
  Download,
  Info,
  X,
  Search,
  Lock,
  Unlock,
} from "lucide-react";
import { formatDate, getTrashRemainingDays } from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";
import SearchHighlight from "../common/SearchHighlight";
import { toast } from "react-toastify";

const FolderCardNew = ({
  folder,
  onOpen,
  onDelete,
  onShare,
  onSelect,
  onRestore,
  onRename,
  onCopy,
  onMove,
  onDownload,
  onProperties,
  onLock,
  viewType = "grid",
  type = "drive",
  searchQuery = "",
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  isDragging = false,
  isDropTarget = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    horizontal: "right",
    vertical: "below",
  });
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);
  const { isSelected, getSelectedCount } = useSelectionContext();
  const selected = isSelected(folder._id);
  const selectedCount = getSelectedCount();
  const hasMultipleSelections = selectedCount > 1;

  // Split folder name for better truncation (folders rarely have extensions, but handle it)
  const splitName = (name) => {
    if (!name) return { base: "", ext: "" };
    const lastDotIndex = name.lastIndexOf(".");
    // If no dot, or dot is first char (hidden folder), treat whole name as base
    if (lastDotIndex <= 0) return { base: name, ext: "" };
    return {
      base: name.substring(0, lastDotIndex),
      ext: name.substring(lastDotIndex),
    };
  };

  const { base: folderBase, ext: folderExt } = splitName(folder.name);

  // Close menu on outside click and escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  // Calculate menu position based on available space
  const handleMenuToggle = (e) => {
    e.preventDefault(); // Prevent default action
    e.stopPropagation(); // Stop propagation to card click

    if (!menuOpen && menuBtnRef.current) {
      const btnRect = menuBtnRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = 300;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = btnRect.bottom + 8;
      let left = btnRect.right - menuWidth;

      // Horizontal check
      if (left < 10) {
        left = btnRect.left;
      }

      // Vertical check
      if (top + menuHeight > viewportHeight) {
        top = btnRect.top - menuHeight - 8;
      }

      setMenuPosition({ top, left });
    }

    setMenuOpen(!menuOpen);
  };

  // Handle card click
  const handleCardClick = (e) => {
    // Prevent action if clicking on action buttons
    if (e.target.closest(`.${styles.actions}`)) {
      return;
    }

    // On mobile, always open folder on single tap
    if (window.innerWidth <= 768) {
      onOpen?.(e);
    } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(e);
    } else {
      onOpen?.(e);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onOpen?.(e);
        break;
      case "Delete":
      case "Backspace":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onDelete?.();
        }
        break;
      default:
        break;
    }
  };

  // Handle checkbox click
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onSelect?.(e);
  };

  // Menu items based on type
  const renderMenuItems = () => {
    if (type === "trash") {
      return (
        <>
          <button
            onClick={() => {
              onRestore?.();
              setMenuOpen(false);
            }}
            className={styles.menuItem}
          >
            <RotateCcw size={16} />
            <span>Restore</span>
          </button>
          <button
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
            className={styles.menuItemDanger}
          >
            <Trash2 size={16} />
            <span>Delete Permanently</span>
          </button>
        </>
      );
    }

    return (
      <>
        {/* Lock/Unlock */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onLock) {
              onLock(folder);
              setMenuOpen(false);
            }
          }}
          className={styles.menuItem}
        >
          {folder.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
          <span>{folder.isLocked ? "Unlock" : "Lock"}</span>
        </button>

        <button
          onClick={() => {
            if (folder.isLocked) {
              toast.error("Unlock item to rename");
              return;
            }
            onRename?.();
            setMenuOpen(false);
          }}
          className={`${styles.menuItem} ${folder.isLocked ? styles.disabled : ""}`}
        >
          <Edit3 size={16} />
          <span>Rename</span>
        </button>

        <button
          onClick={() => {
            if (folder.isLocked) {
              toast.error("Unlock item to copy");
              return;
            }
            onCopy?.();
            setMenuOpen(false);
          }}
          className={`${styles.menuItem} ${folder.isLocked ? styles.disabled : ""}`}
        >
          <Copy size={16} />
          <span>Copy</span>
        </button>

        <button
          onClick={() => {
            if (folder.isLocked) {
              toast.error("Unlock item to move");
              return;
            }
            onMove?.();
            setMenuOpen(false);
          }}
          className={`${styles.menuItem} ${folder.isLocked ? styles.disabled : ""}`}
        >
          <Move size={16} />
          <span>Move</span>
        </button>

        <div className={styles.menuDivider} />

        <button
          onClick={() => {
            onDownload?.();
            setMenuOpen(false);
          }}
          className={styles.menuItem}
        >
          <Download size={16} />
          <span>Download</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
            setMenuOpen(false);
          }}
          className={styles.menuItem}
        >
          <Share2 size={16} />
          <span>Share</span>
        </button>
        <button
          onClick={() => {
            onProperties?.();
            setMenuOpen(false);
          }}
          className={styles.menuItem}
        >
          <Info size={16} />
          <span>Properties</span>
        </button>

        <div className={styles.menuDivider} />

        <button
          onClick={() => {
            if (folder.isLocked) {
              toast.error("Unlock item to delete");
              return;
            }
            onDelete();
            setMenuOpen(false);
          }}
          className={`${styles.menuItemDanger} ${folder.isLocked ? styles.disabled : ""}`}
        >
          <Trash2 size={16} />
          <span>Move to Trash</span>
        </button>
      </>
    );
  };

  return (
    <div
      className={`${styles.card} ${styles[viewType]} ${selected ? styles.selected : ""} ${menuOpen ? styles.menuOpen : ""} ${isDragging ? styles.dragging : ""} ${isDropTarget ? styles.dropTarget : ""}`}
      data-item-id={folder._id}
      tabIndex={0}
      role="group"
      aria-label={`Folder: ${folder.name}`}
      aria-selected={selected}
      draggable={type !== "trash"}
      onDragStart={(e) => onDragStart?.(folder, "folder", e)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onDragOver={(e) => onDragOver?.(folder, e)}
      onDragEnter={(e) => onDragEnter?.(folder, e)}
      onDragLeave={(e) => onDragLeave?.(e)}
      onDrop={(e) => onDrop?.(folder, e)}
      onKeyDown={handleKeyDown}
    >
      {/* Checkbox */}
      <div className={styles.checkbox} onClick={handleCheckboxClick}>
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </div>

      {/* Main Content */}
      <div className={styles.content} onClick={handleCardClick}>
        <div className={styles.icon}>
          <div className={styles.folderIconWrapper}>
            <Folder size={viewType === "grid" ? 28 : 20} />
            {folder.isLocked && (
              <div className={styles.lockIconOverlay} title="Locked">
                <Lock size={12} />
              </div>
            )}
          </div>
        </div>
        <div className={styles.info}>
          <div className={styles.name} title={folder.name}>
            <div className={styles.folderNameRow}>
              {searchQuery ? (
                <SearchHighlight
                  text={folder.name}
                  searchTerm={searchQuery}
                  searchMeta={folder._searchMeta}
                />
              ) : (
                <>
                  <span className={styles.nameBase}>{folderBase}</span>
                  {folderExt && (
                    <span className={styles.nameExt}>{folderExt}</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className={styles.meta}>
            <span className={styles.date}>
              {type === "trash"
                ? `${getTrashRemainingDays(folder.trashedAt)} days left`
                : `Updated ${formatDate(folder.updatedAt)}`}
            </span>
          </div>
        </div>
      </div>

      {/* List view columns */}
      {viewType === "list" && (
        <>
          <div className={styles.sizeColumn}>—</div>
          <div className={styles.dateColumn}>
            {type === "trash"
              ? `${getTrashRemainingDays(folder.trashedAt)} days left`
              : formatDate(folder.updatedAt)}
          </div>
        </>
      )}

      {!hasMultipleSelections && (
        <div className={styles.actions} ref={menuRef}>
          <button
            ref={menuBtnRef}
            className={styles.menuBtn}
            onClick={handleMenuToggle}
            aria-label="Folder actions"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen &&
            createPortal(
              <>
                <div
                  className={styles.portalOverlay}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div
                  className={`${styles.dropdown} ${
                    window.innerWidth <= 768
                      ? styles.bottomSheet
                      : styles.popover
                  }`}
                  style={
                    window.innerWidth > 768
                      ? {
                          top: menuPosition.top,
                          left: menuPosition.left,
                        }
                      : {}
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownTitle}>Actions</span>
                    <button
                      className={styles.closeBtn}
                      onClick={() => setMenuOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.dropdownBody}>{renderMenuItems()}</div>
                </div>
              </>,
              document.body,
            )}
        </div>
      )}
    </div>
  );
};

export default FolderCardNew;
