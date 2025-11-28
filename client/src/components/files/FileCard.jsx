import React, { useState, useRef, useEffect } from "react";
import styles from "./FileCard.module.css";
import {
  Download,
  Share2,
  Trash2,
  MoreVertical,
  CheckSquare,
  Square,
  RotateCcw,
  Edit3,
  Copy,
  Move,
} from "lucide-react";
import {
  formatFileSize as formatSize,
  formatDate,
  getFileIcon,
} from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";

const FileCard = ({
  file,
  onDownload,
  onDelete,
  onShare,
  onSelect,
  onRestore,
  onRename,
  onCopy,
  onMove,
  viewType = "grid",
  type = "drive",
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { isSelected } = useSelectionContext();

  // Validate file object to prevent crashes and provide defaults
  const safeFile =
    file && typeof file === "object"
      ? {
          _id: file._id || "unknown",
          name: file.name || "Unknown File",
          size: file.size || 0,
          updatedAt: file.updatedAt || new Date(),
          ...file,
        }
      : {
          _id: "invalid",
          name: "Invalid File",
          size: 0,
          updatedAt: new Date(),
        };

  const selected = isSelected(safeFile._id);

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
      className={`${styles.fileCard} ${styles[viewType]} ${
        selected ? styles.selected : ""
      } ${menuOpen ? styles.menuOpen : ""}`}
      tabIndex={0}
      aria-label={`File: ${safeFile.name}`}
      role="group"
    >
      {/* Checkbox for selection */}
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

      {/* File content: icon, name, size, date */}
      <div
        className={styles.fileContent}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onSelect?.(e);
          }
        }}
      >
        <div
          className={styles.fileIcon}
          aria-label={safeFile.name}
          title={safeFile.name}
        >
          {getFileIcon(safeFile.name)}
        </div>
        <div className={styles.fileInfo}>
          <div className={styles.fileName} title={safeFile.name}>
            {safeFile.name}
          </div>
          {/* Show details in both views for consistency */}
          <div className={styles.fileDetails}>
            <span>{formatSize(safeFile.size)}</span>
            <span>•</span>
            <span>{formatDate(safeFile.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* For list view, show size and date in columns for better alignment */}
      {viewType === "list" && (
        <>
          <div className={styles.fileSize}>{formatSize(safeFile.size)}</div>
          <div className={styles.fileMeta}>
            {formatDate(safeFile.updatedAt)}
          </div>
        </>
      )}

      {/* Menu and actions */}
      <div className={styles.menuWrapper} ref={menuRef}>
        <button
          className={styles.menuButton}
          aria-label="File actions"
          title="More actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }
            if (e.key === "Escape") {
              setMenuOpen(false);
            }
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div
            className={styles.menuDropdown}
            role="menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setMenuOpen(false);
              }
            }}
          >
            {type !== "trash" ? (
              <>
                <button
                  onClick={() => {
                    onDownload();
                    setMenuOpen(false);
                  }}
                  className={styles.menuItem}
                  aria-label="Download file"
                  title="Download"
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => {
                    onRename?.();
                    setMenuOpen(false);
                  }}
                  className={styles.menuItem}
                  aria-label="Rename file"
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
                  aria-label="Copy file"
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
                  aria-label="Move file"
                  title="Move"
                >
                  <Move size={16} />
                  <span>Move</span>
                </button>
                <div className={styles.menuDivider} />
                <button
                  onClick={() => {
                    onShare();
                    setMenuOpen(false);
                  }}
                  className={styles.menuItem}
                  aria-label="Share file"
                  title="Share"
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className={styles.menuItemDanger}
                  aria-label="Move to trash"
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
                  aria-label="Restore file"
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
                  aria-label="Delete permanently"
                  title="Delete Permanently"
                >
                  <Trash2 size={16} />
                  <span>Delete Permanently</span>
                </button>
              </>
            )}
          </div>
        )}
        {/* Inline actions for list view only */}
        {viewType === "list" &&
          (type !== "trash" ? (
            <>
              <button
                className={styles.actionButton}
                aria-label="Download file"
                title="Download"
                onClick={onDownload}
              >
                <Download size={16} />
              </button>
              <button
                className={styles.actionButton}
                aria-label="Share file"
                title="Share"
                onClick={onShare}
              >
                <Share2 size={16} />
              </button>
              <button
                className={styles.actionButton}
                aria-label="Delete file"
                title="Move to Trash"
                onClick={onDelete}
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.actionButton}
                aria-label="Restore file"
                title="Restore"
                onClick={onRestore}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className={styles.actionButton}
                aria-label="Delete file permanently"
                title="Delete Permanently"
                onClick={onDelete}
              >
                <Trash2 size={16} />
              </button>
            </>
          ))}
      </div>
    </div>
  );
};

export default FileCard;
