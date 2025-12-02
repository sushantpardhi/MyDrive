import { useState, useRef, useEffect } from "react";
import styles from "./FolderCard.module.css";
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
} from "lucide-react";
import { formatDate } from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";
import SearchHighlight from "../common/SearchHighlight";
import OwnerAvatar from "../common/OwnerAvatar";

const FolderCard = ({
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
  viewType = "grid",
  type = "drive",
  searchQuery = "",
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { isSelected, getSelectedCount } = useSelectionContext();
  const selected = isSelected(folder._id);
  const selectedCount = getSelectedCount();
  const hasMultipleSelections = selectedCount > 1;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={`${styles.folderCard} ${styles[viewType]} ${
        selected ? styles.selected : ""
      } ${menuOpen ? styles.menuOpen : ""}`}
      tabIndex={0}
      aria-label={`Folder: ${folder.name}`}
      role="group"
    >
      <div
        className={styles.checkboxWrapper}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(e);
        }}
      >
        {selected ? (
          <CheckSquare size={20} className={styles.checkbox} />
        ) : (
          <Square size={20} className={styles.checkbox} />
        )}
      </div>

      <div
        className={styles.folderContent}
        onClick={(e) => {
          // On mobile, always open folder on single tap
          if (window.innerWidth <= 480) {
            onOpen?.(e);
          } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onSelect?.(e);
          } else {
            onOpen?.(e);
          }
        }}
      >
        <div
          className={styles.folderIcon}
          aria-label={folder.name}
          title={folder.name}
        >
          <Folder size={viewType === "grid" ? 32 : 24} />
        </div>
        <div className={styles.folderInfo}>
          <div className={styles.folderName}>
            <SearchHighlight
              text={folder.name}
              searchTerm={searchQuery}
              searchMeta={folder._searchMeta}
            />
          </div>
          {viewType === "grid" && (
            <div className={styles.folderDetails}>
              Updated {formatDate(folder.updatedAt)}
            </div>
          )}
        </div>
      </div>

      {viewType === "list" && (
        <>
          <div className={styles.folderSize}>—</div>
          <div className={styles.folderMeta}>
            {formatDate(folder.updatedAt)}
          </div>
        </>
      )}

      <div className={styles.menuWrapper} ref={menuRef}>
        {viewType === "grid" ? (
          <>
            {!hasMultipleSelections && (
              <button
                className={styles.menuButton}
                aria-label="Folder actions"
                aria-expanded={menuOpen}
                title="More actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <MoreVertical size={16} />
              </button>
            )}

            {menuOpen && !hasMultipleSelections && (
              <div className={styles.menuDropdown} role="menu">
                {type !== "trash" ? (
                  <>
                    <button
                      onClick={() => {
                        onRename?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Rename folder"
                      title="Rename"
                    >
                      <Edit3 size={16} />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => {
                        onCopy?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Copy folder"
                      title="Copy"
                    >
                      <Copy size={16} />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => {
                        onMove?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Move folder"
                      title="Move"
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
                      aria-label="Download folder"
                      title="Download"
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
                      aria-label="Share folder"
                      title="Share"
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
                      aria-label="Properties"
                      title="Properties"
                    >
                      <Info size={16} />
                      <span>Properties</span>
                    </button>
                    <div className={styles.menuDivider} />
                    <button
                      onClick={() => {
                        onDelete();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItemDanger}
                      aria-label="Move folder to trash"
                      title="Move to Trash"
                    >
                      <Trash2 size={16} />
                      <span>Move to Trash</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onRestore?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Restore folder"
                      title="Restore"
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
                      aria-label="Delete folder permanently"
                      title="Delete Permanently"
                    >
                      <Trash2 size={16} />
                      <span>Delete Permanently</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {!hasMultipleSelections && (
              <button
                className={styles.menuButton}
                aria-label="Folder actions"
                aria-expanded={menuOpen}
                title="More actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <MoreVertical size={16} />
              </button>
            )}

            {menuOpen && !hasMultipleSelections && (
              <div className={styles.menuDropdown} role="menu">
                {type !== "trash" ? (
                  <>
                    <button
                      onClick={() => {
                        onRename?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Rename folder"
                      title="Rename"
                    >
                      <Edit3 size={16} />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => {
                        onCopy?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Copy folder"
                      title="Copy"
                    >
                      <Copy size={16} />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => {
                        onMove?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Move folder"
                      title="Move"
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
                      aria-label="Download folder"
                      title="Download"
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
                      aria-label="Share folder"
                      title="Share"
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
                      aria-label="Properties"
                      title="Properties"
                    >
                      <Info size={16} />
                      <span>Properties</span>
                    </button>
                    <div className={styles.menuDivider} />
                    <button
                      onClick={() => {
                        onDelete();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItemDanger}
                      aria-label="Move folder to trash"
                      title="Move to Trash"
                    >
                      <Trash2 size={16} />
                      <span>Move to Trash</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onRestore?.();
                        setMenuOpen(false);
                      }}
                      className={styles.menuItem}
                      aria-label="Restore folder"
                      title="Restore"
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
                      aria-label="Delete folder permanently"
                      title="Delete Permanently"
                    >
                      <Trash2 size={16} />
                      <span>Delete Permanently</span>
                    </button>
                  </>
                )}
              </div>
            )}
            {!hasMultipleSelections &&
              (type !== "trash" ? (
                <>
                  <button
                    className={styles.actionButton}
                    aria-label="Share folder"
                    title="Share"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare();
                    }}
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    className={styles.actionButton}
                    aria-label="Delete folder"
                    title="Move to Trash"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.actionButton}
                    aria-label="Restore folder"
                    title="Restore"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore?.();
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className={styles.actionButton}
                    aria-label="Delete folder permanently"
                    title="Delete Permanently"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ))}
          </>
        )}
      </div>
    </div>
  );
};

export default FolderCard;
