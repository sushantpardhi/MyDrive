import { useEffect, useState } from "react";
import {
  X,
  File,
  Folder,
  Calendar,
  HardDrive,
  User,
  Users,
  Clock,
  Info,
  ChevronDown,
} from "lucide-react";
import LoadingSpinner from "../common/LoadingSpinner";
import styles from "./PropertiesModal.module.css";
import api from "../../services/api";
import { toast } from "react-toastify";
import { formatFileSize, formatDate } from "../../utils/formatters";

const PropertiesModal = ({ item, itemType, onClose, isOpen }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) {
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        let response;

        if (itemType === "file") {
          response = await api.getFileDetails(item._id);
          setDetails(response.data);
        } else {
          response = await api.getFolderDetails(item._id);
          setDetails(response.data);

          // For folders, get folder stats (file count, total size)
          try {
            const statsResponse = await api.getFolderStats(item._id);
            setStats(statsResponse.data);
          } catch (error) {
            console.log("Could not fetch folder stats:", error);
          }
        }
      } catch (error) {
        console.error("Failed to fetch item details:", error);
        toast.error("Failed to load properties");
        setDetails(item); // Fallback to provided item
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [item, itemType, isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getFileType = (filename) => {
    if (!filename) return "Unknown";
    const ext = filename.split(".").pop().toLowerCase();

    const types = {
      // Images
      jpg: "JPEG Image",
      jpeg: "JPEG Image",
      png: "PNG Image",
      gif: "GIF Image",
      bmp: "Bitmap Image",
      webp: "WebP Image",
      svg: "SVG Image",

      // Documents
      pdf: "PDF Document",
      doc: "Word Document",
      docx: "Word Document",
      xls: "Excel Spreadsheet",
      xlsx: "Excel Spreadsheet",
      ppt: "PowerPoint Presentation",
      pptx: "PowerPoint Presentation",
      txt: "Text Document",

      // Archives
      zip: "ZIP Archive",
      rar: "RAR Archive",
      "7z": "7-Zip Archive",
      tar: "TAR Archive",
      gz: "GZIP Archive",

      // Media
      mp3: "MP3 Audio",
      wav: "WAV Audio",
      mp4: "MP4 Video",
      avi: "AVI Video",
      mkv: "MKV Video",
      mov: "QuickTime Video",

      // Code
      js: "JavaScript File",
      jsx: "React JSX File",
      ts: "TypeScript File",
      tsx: "React TSX File",
      py: "Python Script",
      java: "Java File",
      cpp: "C++ File",
      c: "C File",
      html: "HTML File",
      css: "CSS File",
      json: "JSON File",
    };

    return types[ext] || `${ext.toUpperCase()} File`;
  };

  const renderProperty = (label, value, icon) => {
    if (!value && value !== 0) return null;

    return (
      <div className={styles.property}>
        <div className={styles.propertyLabel}>
          {icon && <span className={styles.propertyIcon}>{icon}</span>}
          <span>{label}</span>
        </div>
        <div className={styles.propertyValue}>{value}</div>
      </div>
    );
  };

  const renderOwnerInfo = () => {
    if (!details?.owner) return null;

    const owner = details.owner;
    const ownerName = typeof owner === "object" ? owner.name : "Unknown";
    const ownerEmail = typeof owner === "object" ? owner.email : "";

    return (
      <div className={styles.property}>
        <div className={styles.propertyLabel}>
          <span className={styles.propertyIcon}>
            <User size={16} />
          </span>
          <span>Owner</span>
        </div>
        <div className={styles.propertyValue}>
          <div>{ownerName}</div>
          {ownerEmail && (
            <div className={styles.propertySubValue}>{ownerEmail}</div>
          )}
        </div>
      </div>
    );
  };

  const renderSharedWith = () => {
    if (!details?.shared || details.shared.length === 0) return null;

    return (
      <div className={styles.property}>
        <div className={styles.propertyLabel}>
          <span className={styles.propertyIcon}>
            <Users size={16} />
          </span>
          <span>Shared with</span>
        </div>
        <div className={styles.propertyValue}>
          {details.shared.map((user, index) => {
            const userName = typeof user === "object" ? user.name : "Unknown";
            const userEmail = typeof user === "object" ? user.email : "";

            return (
              <div key={index} className={styles.sharedUser}>
                <div>{userName}</div>
                {userEmail && (
                  <div className={styles.propertySubValue}>{userEmail}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUploadMetadata = () => {
    if (!details?.uploadMetadata?.isChunkedUpload) return null;

    const metadata = details.uploadMetadata;

    return (
      <>
        {metadata.totalChunks &&
          renderProperty(
            "Upload Method",
            `Chunked (${metadata.totalChunks} chunks)`,
            <Info size={16} />
          )}
        {metadata.uploadStats?.uploadDuration &&
          renderProperty(
            "Upload Duration",
            `${(metadata.uploadStats.uploadDuration / 1000).toFixed(2)}s`,
            <Clock size={16} />
          )}
        {metadata.uploadStats?.averageSpeed &&
          renderProperty(
            "Average Speed",
            `${formatFileSize(metadata.uploadStats.averageSpeed)}/s`,
            <HardDrive size={16} />
          )}
        {metadata.uploadStats?.totalRetries > 0 &&
          renderProperty(
            "Retries",
            metadata.uploadStats.totalRetries,
            <Info size={16} />
          )}
      </>
    );
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>
            {itemType === "file" ? <File size={20} /> : <Folder size={20} />}
            <span>Properties</span>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <LoadingSpinner size="medium" message="Loading properties..." />
          </div>
        ) : (
          <div className={styles.content}>
            {/* Item Name */}
            <div className={styles.itemHeader}>
              <div className={styles.itemIcon}>
                {itemType === "file" ? (
                  <File size={32} />
                ) : (
                  <Folder size={32} />
                )}
              </div>
              <div className={styles.itemName}>
                {details?.name || item?.name}
              </div>
            </div>

            {/* General Properties */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>General</div>
              <div className={styles.properties}>
                {itemType === "file" &&
                  details?.name &&
                  renderProperty(
                    "Type",
                    getFileType(details.name),
                    <File size={16} />
                  )}
                {itemType === "file" &&
                  details?.size !== undefined &&
                  renderProperty(
                    "Size",
                    formatFileSize(details.size),
                    <HardDrive size={16} />
                  )}
                {itemType === "folder" && stats && (
                  <>
                    {renderProperty(
                      "Contains",
                      `${stats.fileCount || 0} ${
                        stats.fileCount === 1 ? "item" : "items"
                      }`,
                      <File size={16} />
                    )}
                    {stats.totalSize > 0 &&
                      renderProperty(
                        "Total Size",
                        formatFileSize(stats.totalSize),
                        <HardDrive size={16} />
                      )}
                  </>
                )}
                {details?.createdAt &&
                  renderProperty(
                    "Created",
                    formatDate(details.createdAt),
                    <Calendar size={16} />
                  )}
                {details?.updatedAt &&
                  renderProperty(
                    "Modified",
                    formatDate(details.updatedAt),
                    <Calendar size={16} />
                  )}
              </div>
            </div>

            {/* Sharing Information */}
            {(details?.owner ||
              (details?.shared && details.shared.length > 0)) && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Sharing</div>
                <div className={styles.properties}>
                  {renderOwnerInfo()}
                  {renderSharedWith()}
                </div>
              </div>
            )}

            {/* Advanced Section (for files with upload metadata) */}
            {itemType === "file" &&
              details?.uploadMetadata?.isChunkedUpload && (
                <div className={styles.section}>
                  <button
                    className={styles.sectionToggle}
                    onClick={() => setAdvancedExpanded(!advancedExpanded)}
                    aria-expanded={advancedExpanded}
                  >
                    <span className={styles.sectionTitle}>Advanced</span>
                    <ChevronDown
                      size={16}
                      className={`${styles.chevron} ${
                        advancedExpanded ? styles.chevronExpanded : ""
                      }`}
                    />
                  </button>
                  {advancedExpanded && (
                    <div className={styles.properties}>
                      {renderUploadMetadata()}
                    </div>
                  )}
                </div>
              )}

            {/* Trash Information */}
            {details?.trash && details?.trashedAt && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Trash</div>
                <div className={styles.properties}>
                  {renderProperty(
                    "Trashed",
                    formatDate(details.trashedAt),
                    <Calendar size={16} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesModal;
