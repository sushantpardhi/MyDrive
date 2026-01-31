import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./FileCardNew.module.css";
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
  Eye,
  FileText,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileCode,
  Info,
  X,
  Lock,
  Unlock,
} from "lucide-react";
import {
  formatFileSize as formatSize,
  formatDate,
  getFileIcon,
  getTrashRemainingDays,
} from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";
import { useUIContext } from "../../contexts";
import SearchHighlight from "../common/SearchHighlight";
import ProgressiveImage from "../common/ProgressiveImage";
import api from "../../services/api";
import logger from "../../utils/logger";
import useLazyLoad from "../../hooks/useLazyLoad";
import { getCachedImage, setCachedImage } from "../../utils/imageCache";
import { toast } from "react-toastify";

const FileCardNew = ({
  file,
  filesList = [],
  onDownload,
  onDelete,
  onShare,
  onSelect,
  onRestore,
  onRename,
  onCopy,
  onMove,
  onProperties,
  onLock,
  viewType = "grid",
  type = "drive",
  searchQuery = "",
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    horizontal: "right",
    vertical: "below",
  });
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);
  const cardRef = useRef(null);
  const { isSelected, getSelectedCount } = useSelectionContext();
  const { openPreviewModal } = useUIContext();

  // Use lazy loading hook to detect when card is visible
  const { ref: lazyRef, isVisible } = useLazyLoad({
    rootMargin: "100px",
    threshold: 0.01,
  });

  // Validate file object
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
  const selectedCount = getSelectedCount();
  const hasMultipleSelections = selectedCount > 1;

  // Get file type for preview
  const getFileType = (filename) => {
    if (!filename) return "unknown";
    const ext = filename.split(".").pop().toLowerCase();

    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) {
      return "image";
    }
    if (ext === "pdf") return "pdf";
    if (["xlsx", "xls", "xlsm", "xlsb", "csv"].includes(ext)) return "excel";
    if (["docx", "doc"].includes(ext)) return "word";
    if (["pptx", "ppt"].includes(ext)) return "powerpoint";
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext))
      return "video";
    if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
    if (
      [
        "txt",
        "md",
        "json",
        "js",
        "jsx",
        "ts",
        "tsx",
        "py",
        "java",
        "c",
        "cpp",
        "cs",
        "go",
        "rs",
        "php",
        "rb",
        "swift",
        "kt",
        "scala",
        "html",
        "css",
        "scss",
        "less",
        "xml",
        "yaml",
        "yml",
        "sql",
        "sh",
        "bash",
        "dockerfile",
      ].includes(ext)
    ) {
      return "code";
    }

    return "unknown";
  };

  const fileType = getFileType(safeFile.name);

  // Load thumbnail for image files with caching
  useEffect(() => {
    let cancelled = false;

    if (
      !isVisible ||
      fileType !== "image" ||
      safeFile._id === "unknown" ||
      safeFile._id === "invalid"
    ) {
      return;
    }

    const loadThumbnail = async () => {
      setThumbnailLoading(true);

      try {
        // First, check if we have a cached version
        const cachedBlob = await getCachedImage(safeFile._id, "thumbnail");

        if (cachedBlob && !cancelled) {
          const url = URL.createObjectURL(cachedBlob);
          setThumbnailUrl(url);
          setThumbnailError(false);
          setThumbnailLoading(false);
          return;
        }

        // Not in cache, fetch from server
        const response = await api.getFileThumbnail(safeFile._id);

        if (!cancelled) {
          // Cache the blob for future use
          await setCachedImage(safeFile._id, response.data, "thumbnail");

          const url = URL.createObjectURL(response.data);
          setThumbnailUrl(url);
          setThumbnailError(false);
          setThumbnailLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error("Error loading thumbnail", {
            fileId: safeFile._id,
            fileName: safeFile.name,
            error: error.message,
          });
          setThumbnailError(true);
          setThumbnailLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [isVisible, safeFile._id, fileType, safeFile.name]);

  // Get icon component for file type
  const getFileTypeIcon = () => {
    const iconSize = viewType === "grid" ? 32 : 20;
    switch (fileType) {
      case "pdf":
        return <FileText size={iconSize} className={styles.typeIcon} />;
      case "excel":
        return <FileSpreadsheet size={iconSize} className={styles.typeIcon} />;
      case "word":
        return <FileText size={iconSize} className={styles.typeIcon} />;
      case "powerpoint":
        return <FileSpreadsheet size={iconSize} className={styles.typeIcon} />;
      case "video":
        return <FileVideo size={iconSize} className={styles.typeIcon} />;
      case "audio":
        return <FileAudio size={iconSize} className={styles.typeIcon} />;
      case "code":
        return <FileCode size={iconSize} className={styles.typeIcon} />;
      default:
        return (
          <div className={styles.emojiIcon}>{getFileIcon(safeFile.name)}</div>
        );
    }
  };

  // Check if file type is previewable
  const isPreviewable = (filename) => {
    if (!filename) return false;
    const ext = filename.split(".").pop().toLowerCase();
    const previewableExts = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "bmp",
      "webp",
      "svg",
      "heic",
      "heif",
      "avif",
      "pdf",
      "xlsx",
      "xls",
      "xlsm",
      "xlsb",
      "csv",
      "docx",
      "doc",
      "pptx",
      "ppt",
      "mp4",
      "webm",
      "ogg",
      "mov",
      "mp3",
      "wav",
      "flac",
      "m4a",
      "txt",
      "md",
      "json",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "php",
      "rb",
      "swift",
      "kt",
      "scala",
      "html",
      "css",
      "scss",
      "less",
      "xml",
      "yaml",
      "yml",
      "sql",
      "sh",
      "bash",
      "dockerfile",
    ];
    return previewableExts.includes(ext);
  };

  const handlePreview = () => {
    if (isPreviewable(safeFile.name)) {
      openPreviewModal(safeFile, filesList);
    }
  };

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
    e.preventDefault();
    e.stopPropagation();

    if (!menuOpen && menuBtnRef.current) {
      const btnRect = menuBtnRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = 300;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = btnRect.bottom + 8;
      let left = btnRect.right - menuWidth; // Default align right edge

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

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(e);
    } else if (type !== "trash") {
      handlePreview();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (type !== "trash") {
          handlePreview();
        }
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

  // Render thumbnail or icon
  const renderThumbnail = () => {
    if (fileType === "image" && thumbnailUrl && !thumbnailError) {
      return (
        <ProgressiveImage
          thumbnailUrl={thumbnailUrl}
          alt={safeFile.name}
          mode="thumbnail"
          className={styles.thumbnail}
        />
      );
    }
    if (fileType === "image" && thumbnailLoading && !thumbnailError) {
      return (
        <div className={styles.thumbnailLoading}>
          <div className={styles.spinner}></div>
        </div>
      );
    }
    return <div className={styles.fileTypePreview}>{getFileTypeIcon()}</div>;
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
        {isPreviewable(safeFile.name) && (
          <button
            onClick={() => {
              handlePreview();
              setMenuOpen(false);
            }}
            className={styles.menuItem}
          >
            <Eye size={16} />
            <span>Preview</span>
          </button>
        )}
        <button
          onClick={() => {
            onDownload();
            setMenuOpen(false);
          }}
          className={styles.menuItem}
        >
          <Download size={16} />
          <span>Download</span>
        </button>
        {/* Lock/Unlock */}
        <button
          className={styles.menuItem}
          onClick={(e) => {
            e.stopPropagation();
            onLock(safeFile);
            setMenuOpen(false);
          }}
        >
          {safeFile.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
          <span>{safeFile.isLocked ? "Unlock" : "Lock"}</span>
        </button>

        {/* Rename - Disabled if locked */}
        <button
          className={`${styles.menuItem} ${safeFile.isLocked ? styles.disabled : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (safeFile.isLocked) {
              toast.error("Unlock item to rename");
              return;
            }
            onRename?.();
            setMenuOpen(false);
          }}
        >
          <Edit3 size={16} />
          <span>Rename</span>
        </button>

        {/* Copy - Disabled if locked */}
        <button
          className={`${styles.menuItem} ${safeFile.isLocked ? styles.disabled : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (safeFile.isLocked) {
              toast.error("Unlock item to copy");
              return;
            }
            onCopy?.();
            setMenuOpen(false);
          }}
        >
          <Copy size={16} />
          <span>Copy</span>
        </button>

        {/* Move - Disabled if locked */}
        <button
          className={`${styles.menuItem} ${safeFile.isLocked ? styles.disabled : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (safeFile.isLocked) {
              toast.error("Unlock item to move");
              return;
            }
            onMove?.();
            setMenuOpen(false);
          }}
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
        <button
          onClick={() => {
            if (safeFile.isLocked) {
              toast.error("Unlock item to delete");
              return;
            }
            onDelete();
            setMenuOpen(false);
          }}
          className={`${styles.menuItemDanger} ${safeFile.isLocked ? styles.disabled : ""}`}
        >
          <Trash2 size={16} />
          <span>Move to Trash</span>
        </button>
      </>
    );
  };

  return (
    <div
      ref={(node) => {
        lazyRef.current = node;
        cardRef.current = node;
      }}
      className={`${styles.card} ${styles[viewType]} ${selected ? styles.selected : ""} ${menuOpen ? styles.menuOpen : ""} ${isDragging ? styles.dragging : ""}`}
      data-item-id={safeFile._id}
      tabIndex={0}
      role="group"
      aria-label={`File: ${safeFile.name}`}
      aria-selected={selected}
      draggable={type !== "trash"}
      onDragStart={(e) => onDragStart?.(safeFile, "file", e)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onKeyDown={handleKeyDown}
    >
      {/* Checkbox */}
      <div className={styles.checkbox} onClick={handleCheckboxClick}>
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </div>

      {/* Main Content */}
      <div className={styles.content} onClick={handleCardClick}>
        <div className={styles.icon}>
          <div className={styles.fileIconWrapper}>
            {renderThumbnail()}
            {safeFile.isLocked && (
              <div className={styles.lockIconOverlay} title="Locked">
                <Lock size={12} />
              </div>
            )}
          </div>
        </div>
        <div className={styles.info}>
          <div className={styles.name} title={safeFile.name}>
            <div className={styles.fileNameRow}>
              <SearchHighlight
                text={safeFile.name}
                searchTerm={searchQuery}
                searchMeta={safeFile._searchMeta}
              />
            </div>
          </div>
          <div className={styles.meta}>
            <span className={styles.size}>{formatSize(safeFile.size)}</span>
            <span className={styles.dot}>•</span>
            <span className={styles.date}>
              {type === "trash"
                ? `${getTrashRemainingDays(safeFile.trashedAt)} days left`
                : formatDate(safeFile.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* List view columns */}
      {viewType === "list" && (
        <>
          <div className={styles.sizeColumn}>{formatSize(safeFile.size)}</div>
          <div className={styles.dateColumn}>
            {type === "trash"
              ? `${getTrashRemainingDays(safeFile.trashedAt)} days left`
              : formatDate(safeFile.updatedAt)}
          </div>
        </>
      )}

      {/* Actions Menu */}
      {!hasMultipleSelections && (
        <div className={styles.actions} ref={menuRef}>
          <button
            ref={menuBtnRef}
            className={styles.menuBtn}
            onClick={handleMenuToggle}
            aria-label="File actions"
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

export default FileCardNew;
