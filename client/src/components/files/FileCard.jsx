import { useState, useRef, useEffect } from "react";
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
  Eye,
  FileText,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileCode,
  Info,
} from "lucide-react";
import {
  formatFileSize as formatSize,
  formatDate,
  getFileIcon,
} from "../../utils/formatters";
import { useSelectionContext } from "../../contexts/SelectionContext";
import { useUIContext } from "../../contexts";
import OwnerAvatar from "../common/OwnerAvatar";
import SearchHighlight from "../common/SearchHighlight";
import api from "../../services/api";
import logger from "../../utils/logger";

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
  onProperties,
  viewType = "grid",
  type = "drive",
  searchQuery = "",
  onDragStart,
  onDragEnd,
  isDragging = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const menuRef = useRef(null);
  const { isSelected, getSelectedCount } = useSelectionContext();
  const { openPreviewModal } = useUIContext();

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

  // Load thumbnail for image files
  useEffect(() => {
    let cancelled = false;

    if (
      fileType === "image" &&
      safeFile._id !== "unknown" &&
      safeFile._id !== "invalid"
    ) {
      const loadThumbnail = async () => {
        try {
          const response = await api.getFileThumbnail(safeFile._id);

          if (!cancelled) {
            const url = URL.createObjectURL(response.data);
            setThumbnailUrl(url);
            setThumbnailError(false);
          }
        } catch (error) {
          if (!cancelled) {
            logger.logError(error, "Error loading thumbnail", {
              fileId: safeFile._id,
              fileName: safeFile.name,
            });
            setThumbnailError(true);
          }
        }
      };

      loadThumbnail();
    }

    return () => {
      cancelled = true;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [safeFile._id, fileType, safeFile.name, thumbnailUrl]);

  // Get icon component for file type
  const getFileTypeIcon = () => {
    switch (fileType) {
      case "pdf":
        return <FileText size={48} className={styles.typeIcon} />;
      case "excel":
        return <FileSpreadsheet size={48} className={styles.typeIcon} />;
      case "word":
        return <FileText size={48} className={styles.typeIcon} />;
      case "powerpoint":
        return <FileSpreadsheet size={48} className={styles.typeIcon} />;
      case "video":
        return <FileVideo size={48} className={styles.typeIcon} />;
      case "audio":
        return <FileAudio size={48} className={styles.typeIcon} />;
      case "code":
        return <FileCode size={48} className={styles.typeIcon} />;
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
      // Images
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
      // PDFs
      "pdf",
      // Office Documents
      "xlsx",
      "xls",
      "xlsm",
      "xlsb",
      "csv",
      "docx",
      "doc",
      "pptx",
      "ppt",
      // Videos
      "mp4",
      "webm",
      "ogg",
      "mov",
      // Audio
      "mp3",
      "wav",
      "ogg",
      "flac",
      "m4a",
      // Text/Code
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
      openPreviewModal(safeFile);
    }
  };

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
      } ${menuOpen ? styles.menuOpen : ""} ${
        isDragging ? styles.dragging : ""
      }`}
      data-item-id={safeFile._id}
      tabIndex={0}
      aria-label={`File: ${safeFile.name}`}
      role="group"
      draggable={type !== "trash"}
      onDragStart={(e) => onDragStart?.(safeFile, "file", e)}
      onDragEnd={(e) => onDragEnd?.(e)}
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
          } else if (type !== "trash") {
            // Open preview on regular click
            handlePreview();
          }
        }}
        style={{
          cursor:
            type !== "trash" && isPreviewable(safeFile.name)
              ? "pointer"
              : "default",
        }}
      >
        <div
          className={styles.fileIcon}
          aria-label={safeFile.name}
          title={safeFile.name}
        >
          {fileType === "image" && thumbnailUrl && !thumbnailError ? (
            <div className={styles.thumbnail}>
              <img
                src={thumbnailUrl}
                alt={safeFile.name}
                className={styles.thumbnailImage}
                onError={() => setThumbnailError(true)}
              />
            </div>
          ) : fileType === "image" && !thumbnailError ? (
            <div className={styles.thumbnailLoading}>
              <div className={styles.spinner}></div>
            </div>
          ) : (
            <div className={styles.fileTypePreview}>{getFileTypeIcon()}</div>
          )}
        </div>
        <div className={styles.fileInfo}>
          <div className={styles.fileName} title={safeFile.name}>
            <SearchHighlight
              text={safeFile.name}
              searchTerm={searchQuery}
              searchMeta={safeFile._searchMeta}
            />
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
        {!hasMultipleSelections && (
          <button
            className={styles.menuButton}
            aria-label="File actions"
            aria-expanded={menuOpen}
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
        )}
        {menuOpen && !hasMultipleSelections && (
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
                {isPreviewable(safeFile.name) && (
                  <button
                    onClick={() => {
                      handlePreview();
                      setMenuOpen(false);
                    }}
                    className={styles.menuItem}
                    aria-label="Preview file"
                    title="Preview"
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
          !hasMultipleSelections &&
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
