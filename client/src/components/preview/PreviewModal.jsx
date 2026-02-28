import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Info,
  ExternalLink,
  Calendar,
  User,
  HardDrive,
  Tag,
  Clock,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  getFileType,
  getFileTypeCategory,
  getFileTypeIcon,
} from "./previewUtils";
import { formatFileSize } from "../../utils/formatters";
import { useUIContext } from "../../contexts";
import api from "../../services/api";

// Preview sub-components
import PDFPreview from "./PDFPreview";
import VideoPreview from "./VideoPreview";
import ImagePreview from "./ImagePreview";
import TextPreview from "./TextPreview";
import AudioPreview from "./AudioPreview";
import OfficePreview from "./OfficePreview";
import OtherPreview from "./OtherPreview";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";

import styles from "./PreviewModal.module.css";

const PreviewModal = () => {
  const {
    previewModalOpen,
    previewFile,
    previewFileList,
    previewFileIndex,
    closePreviewModal,
    goToPreviousFile,
    goToNextFile,
  } = useUIContext();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [metadataSidebarOpen, setMetadataSidebarOpen] = useState(false);
  const [metadata, setMetadata] = useState(null);

  // File type detection
  const fileType = useMemo(
    () => (previewFile ? getFileType(previewFile.name) : "unknown"),
    [previewFile],
  );

  const fileCategory = useMemo(
    () =>
      previewFile
        ? getFileTypeCategory(previewFile.name)
        : { label: "File", color: "#888" },
    [previewFile],
  );

  const FileIcon = useMemo(
    () => (previewFile ? getFileTypeIcon(previewFile.name) : null),
    [previewFile],
  );

  // Load metadata when sidebar opens
  useEffect(() => {
    if (metadataSidebarOpen && previewFile) {
      api
        .getFileMetadata(previewFile._id)
        .then((res) => setMetadata(res.data))
        .catch(() => setMetadata(null));
    }
  }, [metadataSidebarOpen, previewFile]);

  // Reset state when file changes
  useEffect(() => {
    setShowKeyboardHelp(false);
    setMetadata(null);
  }, [previewFile]);

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!previewFile) return;
    try {
      const response = await api.downloadFile(previewFile._id);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", previewFile.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
    }
  }, [previewFile]);

  // Open in new tab
  const handleOpenInNewTab = useCallback(() => {
    if (!previewFile) return;
    const streamUrl = api.getFileStreamUrl(previewFile._id);
    window.open(streamUrl, "_blank");
  }, [previewFile]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!previewModalOpen) return;

    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key) {
        case "Escape":
          if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else {
            closePreviewModal();
          }
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (previewFileList.length > 1) {
            goToPreviousFile();
            e.preventDefault();
          }
          break;
        case "ArrowRight":
          if (previewFileList.length > 1) {
            goToNextFile();
            e.preventDefault();
          }
          break;
        case "f":
        case "F":
          if (!e.ctrlKey && !e.metaKey) {
            setIsFullScreen((prev) => !prev);
            e.preventDefault();
          }
          break;
        case "d":
        case "D":
          if (!e.ctrlKey && !e.metaKey) {
            handleDownload();
            e.preventDefault();
          }
          break;
        case "i":
        case "I":
          if (!e.ctrlKey && !e.metaKey) {
            setMetadataSidebarOpen((prev) => !prev);
            e.preventDefault();
          }
          break;
        case "?":
          setShowKeyboardHelp((prev) => !prev);
          e.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    previewModalOpen,
    closePreviewModal,
    goToPreviousFile,
    goToNextFile,
    previewFileList,
    showKeyboardHelp,
    handleDownload,
  ]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (previewModalOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [previewModalOpen]);

  if (!previewModalOpen || !previewFile) return null;

  // Strategy pattern — select preview component based on file type
  const renderPreview = () => {
    const commonProps = { file: previewFile, onDownload: handleDownload };

    switch (fileType) {
      case "pdf":
        return <PDFPreview {...commonProps} />;
      case "video":
        return <VideoPreview {...commonProps} />;
      case "image":
        return <ImagePreview {...commonProps} />;
      case "text":
        return <TextPreview {...commonProps} />;
      case "audio":
        return <AudioPreview {...commonProps} />;
      case "excel":
      case "word":
      case "powerpoint":
        return <OfficePreview {...commonProps} fileType={fileType} />;
      case "svg":
      case "markdown":
      case "json":
      case "archive":
      case "epub":
      case "font":
      case "3d":
      case "subtitle":
      case "diff":
        return <OtherPreview {...commonProps} fileType={fileType} />;
      case "unknown":
        return (
          <PreviewError
            error="Preview not available for this file type"
            onDownload={handleDownload}
            fileName={previewFile.name}
          />
        );
      default:
        return <PreviewLoading />;
    }
  };

  const shortcuts = [
    { key: "Esc", desc: "Close preview" },
    { key: "← →", desc: "Navigate files" },
    { key: "F", desc: "Toggle fullscreen" },
    { key: "D", desc: "Download file" },
    { key: "I", desc: "Toggle file info" },
    { key: "?", desc: "Show shortcuts" },
  ];

  const modal = (
    <div
      className={`${styles.modalOverlay} ${isFullScreen ? styles.fullScreen : ""}`}
      onClick={closePreviewModal}
    >
      {/* File Navigation Arrows */}
      {previewFileList.length > 1 && (
        <>
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousFile();
            }}
            title="Previous file (←)"
            aria-label="Previous file"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={(e) => {
              e.stopPropagation();
              goToNextFile();
            }}
            title="Next file (→)"
            aria-label="Next file"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      {/* File Counter */}
      {previewFileList.length > 1 && (
        <div
          className={styles.fileCounter}
          onClick={(e) => e.stopPropagation()}
        >
          {previewFileIndex + 1} / {previewFileList.length}
        </div>
      )}

      {/* Modal Content */}
      <div
        className={`${styles.modalContent} ${isFullScreen ? styles.fullScreenContent : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.fileInfo}>
            <div
              className={styles.fileTypeBadge}
              style={{ backgroundColor: fileCategory.color }}
            >
              {fileCategory.label}
            </div>
            <div className={styles.fileTitleGroup}>
              <h2>{previewFile.name}</h2>
              <span className={styles.fileSize}>
                {formatFileSize(previewFile.size)}
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowKeyboardHelp((prev) => !prev)}
              className={styles.iconButton}
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={18} />
            </button>

            {/* Metadata sidebar */}
            <button
              onClick={() => setMetadataSidebarOpen((prev) => !prev)}
              className={styles.iconButton}
              title="File Info (I)"
            >
              {metadataSidebarOpen ? (
                <PanelRightClose size={18} />
              ) : (
                <PanelRightOpen size={18} />
              )}
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullScreen((prev) => !prev)}
              className={styles.iconButton}
              title="Fullscreen (F)"
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            {/* Open in new tab */}
            <button
              onClick={handleOpenInNewTab}
              className={styles.iconButton}
              title="Open in New Tab"
            >
              <ExternalLink size={18} />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className={styles.iconButton}
              title="Download (D)"
            >
              <Download size={18} />
            </button>

            {/* Close */}
            <button
              onClick={closePreviewModal}
              className={styles.iconButton}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className={styles.previewContainer}>
          {renderPreview()}

          {/* Keyboard Help Overlay */}
          {showKeyboardHelp && (
            <div
              className={styles.keyboardOverlay}
              onClick={() => setShowKeyboardHelp(false)}
            >
              <div
                className={styles.keyboardHelp}
                onClick={(e) => e.stopPropagation()}
              >
                <h3>Keyboard Shortcuts</h3>
                <div className={styles.shortcutList}>
                  {shortcuts.map((s) => (
                    <div key={s.key} className={styles.shortcut}>
                      <span className={styles.shortcutKey}>{s.key}</span>
                      <span className={styles.shortcutDesc}>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metadata Sidebar */}
          {metadataSidebarOpen && (
            <div className={styles.metadataSidebar}>
              <div className={styles.metadataSection}>
                <h4>File Details</h4>
                <div className={styles.metadataItem}>
                  {FileIcon && (
                    <FileIcon size={16} className={styles.metadataIcon} />
                  )}
                  <div>
                    <div className={styles.metadataLabel}>Name</div>
                    <div className={styles.metadataValue}>
                      {previewFile.name}
                    </div>
                  </div>
                </div>
                <div className={styles.metadataItem}>
                  <HardDrive size={16} className={styles.metadataIcon} />
                  <div>
                    <div className={styles.metadataLabel}>Size</div>
                    <div className={styles.metadataValue}>
                      {formatFileSize(previewFile.size)}
                    </div>
                  </div>
                </div>
                <div className={styles.metadataItem}>
                  <Info size={16} className={styles.metadataIcon} />
                  <div>
                    <div className={styles.metadataLabel}>Type</div>
                    <div className={styles.metadataValue}>
                      {previewFile.type || fileCategory.label}
                    </div>
                  </div>
                </div>
              </div>

              {metadata && (
                <>
                  <div className={styles.metadataSection}>
                    <h4>Dates</h4>
                    <div className={styles.metadataItem}>
                      <Calendar size={16} className={styles.metadataIcon} />
                      <div>
                        <div className={styles.metadataLabel}>Created</div>
                        <div className={styles.metadataValue}>
                          {new Date(metadata.createdAt).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </div>
                      </div>
                    </div>
                    {metadata.updatedAt && (
                      <div className={styles.metadataItem}>
                        <Clock size={16} className={styles.metadataIcon} />
                        <div>
                          <div className={styles.metadataLabel}>Modified</div>
                          <div className={styles.metadataValue}>
                            {new Date(metadata.updatedAt).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {metadata.owner && (
                    <div className={styles.metadataSection}>
                      <h4>Owner</h4>
                      <div className={styles.metadataItem}>
                        <User size={16} className={styles.metadataIcon} />
                        <div>
                          <div className={styles.metadataValue}>
                            {metadata.owner.name || metadata.owner.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {metadata.tags && metadata.tags.length > 0 && (
                    <div className={styles.metadataSection}>
                      <h4>Tags</h4>
                      <div className={styles.metadataItem}>
                        <Tag size={16} className={styles.metadataIcon} />
                        <div>
                          <div className={styles.metadataValue}>
                            {metadata.tags.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PreviewModal;
