import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import {
  formatFileSize as formatSize,
  formatDate,
  getFileIcon,
} from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";
import { useUIContext } from "../../contexts";
import SearchHighlight from "../common/SearchHighlight";
import ProgressiveImage from "../common/ProgressiveImage";
import api from "../../services/api";
import logger from "../../utils/logger";
import useLazyLoad from "../../hooks/useLazyLoad";
import { getCachedImage, setCachedImage } from "../../utils/imageCache";

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
  viewType = "grid",
  type = "drive",
  searchQuery = "",
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ horizontal: "right", vertical: "below" });
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
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "audio";
    if (
      ["txt", "md", "json", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rs", "php", "rb", "swift", "kt", "scala", "html", "css", "scss", "less", "xml", "yaml", "yml", "sql", "sh", "bash", "dockerfile"].includes(ext)
    ) {
      return "code";
    }

    return "unknown";
  };

  const fileType = getFileType(safeFile.name);

  // Load thumbnail for image files with caching
  useEffect(() => {
    let cancelled = false;

    if (!isVisible || fileType !== "image" || safeFile._id === "unknown" || safeFile._id === "invalid") {
      return;
    }

    const loadThumbnail = async () => {
      setThumbnailLoading(true);

      try {
        // First, check if we have a cached version
        const cachedBlob = await getCachedImage(safeFile._id, 'thumbnail');
        
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
          await setCachedImage(safeFile._id, response.data, 'thumbnail');
          
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
        return <div className={styles.emojiIcon}>{getFileIcon(safeFile.name)}</div>;
    }
  };

  // Check if file type is previewable
  const isPreviewable = (filename) => {
    if (!filename) return false;
    const ext = filename.split(".").pop().toLowerCase();
    const previewableExts = [
      "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "heic", "heif", "avif",
      "pdf", "xlsx", "xls", "xlsm", "xlsb", "csv", "docx", "doc", "pptx", "ppt",
      "mp4", "webm", "ogg", "mov", "mp3", "wav", "flac", "m4a",
      "txt", "md", "json", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rs", "php", "rb", "swift", "kt", "scala", "html", "css", "scss", "less", "xml", "yaml", "yml", "sql", "sh", "bash", "dockerfile",
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
    e.stopPropagation();
    
    if (!menuOpen && menuBtnRef.current) {
      const btnRect = menuBtnRef.current.getBoundingClientRect();
      const menuWidth = 180; // min-width of dropdown
      const menuHeight = 300; // approximate max height of dropdown
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceOnRight = viewportWidth - btnRect.right;
      const spaceBelow = viewportHeight - btnRect.bottom;
      
      // Determine horizontal position
      const horizontal = spaceOnRight < menuWidth + 16 ? "left" : "right";
      
      // Determine vertical position - open above if in bottom half or not enough space below
      const vertical = spaceBelow < menuHeight ? "above" : "below";
      
      setMenuPosition({ horizontal, vertical });
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
          <button onClick={() => { onRestore?.(); setMenuOpen(false); }} className={styles.menuItem}>
            <RotateCcw size={16} />
            <span>Restore</span>
          </button>
          <button onClick={() => { onDelete(); setMenuOpen(false); }} className={styles.menuItemDanger}>
            <Trash2 size={16} />
            <span>Delete Permanently</span>
          </button>
        </>
      );
    }

    return (
      <>
        {isPreviewable(safeFile.name) && (
          <button onClick={() => { handlePreview(); setMenuOpen(false); }} className={styles.menuItem}>
            <Eye size={16} />
            <span>Preview</span>
          </button>
        )}
        <button onClick={() => { onDownload(); setMenuOpen(false); }} className={styles.menuItem}>
          <Download size={16} />
          <span>Download</span>
        </button>
        <button onClick={() => { onRename?.(); setMenuOpen(false); }} className={styles.menuItem}>
          <Edit3 size={16} />
          <span>Rename</span>
        </button>
        <button onClick={() => { onCopy?.(); setMenuOpen(false); }} className={styles.menuItem}>
          <Copy size={16} />
          <span>Copy</span>
        </button>
        <button onClick={() => { onMove?.(); setMenuOpen(false); }} className={styles.menuItem}>
          <Move size={16} />
          <span>Move</span>
        </button>
        <div className={styles.menuDivider} />
        <button onClick={() => { onShare(); setMenuOpen(false); }} className={styles.menuItem}>
          <Share2 size={16} />
          <span>Share</span>
        </button>
        <button onClick={() => { onProperties?.(); setMenuOpen(false); }} className={styles.menuItem}>
          <Info size={16} />
          <span>Properties</span>
        </button>
        <button onClick={() => { onDelete(); setMenuOpen(false); }} className={styles.menuItemDanger}>
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
        <div className={styles.icon}>{renderThumbnail()}</div>
        <div className={styles.info}>
          <div className={styles.name} title={safeFile.name}>
            <SearchHighlight
              text={safeFile.name}
              searchTerm={searchQuery}
              searchMeta={safeFile._searchMeta}
            />
          </div>
          <div className={styles.meta}>
            <span className={styles.size}>{formatSize(safeFile.size)}</span>
            <span className={styles.dot}>•</span>
            <span className={styles.date}>{formatDate(safeFile.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* List view columns */}
      {viewType === "list" && (
        <>
          <div className={styles.sizeColumn}>{formatSize(safeFile.size)}</div>
          <div className={styles.dateColumn}>{formatDate(safeFile.updatedAt)}</div>
        </>
      )}

      {/* Actions Menu */}
      {!hasMultipleSelections && (
        <div className={styles.actions} ref={menuRef}>
          {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}
          
          <button
            ref={menuBtnRef}
            className={styles.menuBtn}
            onClick={handleMenuToggle}
            aria-label="File actions"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className={`${styles.dropdown} ${menuPosition.horizontal === "left" ? styles.dropdownLeft : ""} ${menuPosition.vertical === "above" ? styles.dropdownAbove : ""}`}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Actions</span>
                <button className={styles.closeBtn} onClick={() => setMenuOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.dropdownBody}>{renderMenuItems()}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileCardNew;
