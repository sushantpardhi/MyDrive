import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Files,
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileIcon,
  HardDrive,
  FolderOpen,
  Users,
  RefreshCw,
} from "lucide-react";
import { useAdmin, useAuth } from "../../contexts";
import { formatFileSize, formatDate } from "../../utils/formatters";
import logger from "../../utils/logger";
import styles from "./FileManagement.module.css";

// Helper function to get file type icon
const getFileTypeIcon = (mimeType) => {
  if (!mimeType) return FileIcon;

  const type = mimeType.toLowerCase();

  // Handle file extensions
  if (type.startsWith(".")) {
    if (
      type.includes(".jpg") ||
      type.includes(".jpeg") ||
      type.includes(".png") ||
      type.includes(".gif") ||
      type.includes(".svg")
    )
      return FileImage;
    if (type.includes(".mp4") || type.includes(".avi") || type.includes(".mov"))
      return FileVideo;
    if (type.includes(".mp3") || type.includes(".wav") || type.includes(".ogg"))
      return FileAudio;
    if (
      type.includes(".xlsx") ||
      type.includes(".xls") ||
      type.includes(".docx") ||
      type.includes(".doc") ||
      type.includes(".pptx") ||
      type.includes(".pdf") ||
      type.includes(".txt")
    )
      return FileText;
    return FileIcon;
  }

  // Handle MIME types
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  if (type.includes("pdf")) return FileText;
  if (type.includes("text")) return FileText;
  if (type.includes("document") || type.includes("word")) return FileText;
  if (type.includes("sheet") || type.includes("excel")) return FileText;
  if (type.includes("presentation") || type.includes("powerpoint"))
    return FileText;

  return FileIcon;
};

// Helper function to get readable file type
const getReadableFileType = (mimeType) => {
  if (!mimeType) return "Unknown";

  // Handle file extensions (like .xlsx, .docx, etc.)
  const extensionMap = {
    ".xlsx": "Excel",
    ".xls": "Excel",
    ".docx": "Word",
    ".doc": "Word",
    ".pptx": "PowerPoint",
    ".ppt": "PowerPoint",
    ".pdf": "PDF",
    ".txt": "Text",
    ".csv": "CSV",
    ".zip": "Archive",
    ".rar": "Archive",
    ".7z": "Archive",
    ".mp4": "Video",
    ".avi": "Video",
    ".mov": "Video",
    ".mp3": "Audio",
    ".wav": "Audio",
    ".jpg": "Image",
    ".jpeg": "Image",
    ".png": "Image",
    ".gif": "Image",
    ".svg": "Image",
  };

  // Check if it's a file extension
  if (mimeType.startsWith(".")) {
    const lowerType = mimeType.toLowerCase();
    if (extensionMap[lowerType]) {
      return extensionMap[lowerType];
    }
    return mimeType.substring(1).toUpperCase();
  }

  // Handle MIME types
  const typeMap = {
    "image/": "Image",
    "video/": "Video",
    "audio/": "Audio",
    "application/pdf": "PDF",
    "text/": "Text",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml": "Excel",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml": "Word",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.presentationml":
      "PowerPoint",
    "application/zip": "Archive",
    "application/x-rar": "Archive",
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (mimeType.includes(key)) return value;
  }

  const parts = mimeType.split("/");
  return parts[parts.length - 1].toUpperCase();
};

const FileManagement = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { files, filesPagination, loading, fetchFiles, deleteFile } =
    useAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [mimeTypeFilter, setMimeTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("uploadedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Log files for debugging
  useEffect(() => {
    if (files && files.length > 0) {
      logger.debug("Files received in FileManagement", {
        count: files.length,
        sampleFile: files[0],
        filesWithNullOwner: files.filter((f) => !f.owner).length,
      });
    }
  }, [files]);

  // Get unique file types from current files
  const availableFileTypes = useMemo(() => {
    if (!files || files.length === 0) return [];

    const typesSet = new Set();
    files.forEach((file) => {
      if (file.mimeType) {
        const type = file.mimeType.toLowerCase();
        // Categorize by main type
        if (type.startsWith("image/")) typesSet.add("image");
        else if (type.startsWith("video/")) typesSet.add("video");
        else if (type.startsWith("audio/")) typesSet.add("audio");
        else if (type.includes("pdf")) typesSet.add("application/pdf");
        else if (type.startsWith("text/")) typesSet.add("text");
        else if (
          type.includes("word") ||
          type.includes("document") ||
          type.includes(".doc")
        )
          typesSet.add("application/msword");
        else if (
          type.includes("sheet") ||
          type.includes("excel") ||
          type.includes(".xls")
        )
          typesSet.add("application/vnd.ms-excel");
        else if (
          type.includes("presentation") ||
          type.includes("powerpoint") ||
          type.includes(".ppt")
        )
          typesSet.add("application/vnd.ms-powerpoint");
        else if (type.includes("zip") || type.includes("rar"))
          typesSet.add("application/zip");
      }
    });

    return Array.from(typesSet).sort();
  }, [files]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!files || files.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        uniqueOwners: 0,
        averageSize: 0,
      };
    }

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const uniqueOwners = new Set(files.map((f) => f.owner?._id).filter(Boolean))
      .size;

    return {
      totalFiles: filesPagination.total || files.length,
      totalSize,
      uniqueOwners,
      averageSize: totalSize / files.length,
    };
  }, [files, filesPagination]);

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/drive");
      return;
    }
    loadFiles();
  }, [currentUser]);

  const handleExportFiles = async () => {
    setIsExporting(true);
    try {
      const csvContent = [
        ["Name", "Owner", "Size", "Type", "Uploaded"].join(","),
        ...files.map((file) =>
          [
            file.name,
            file.owner?.name || "Unknown",
            formatFileSize(file.size || 0),
            getReadableFileType(file.mimeType),
            formatDate(file.uploadedAt || file.createdAt),
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `files-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      logger.info("Files exported successfully");
    } catch (error) {
      logger.error("Failed to export files", { error: error.message });
      alert("Failed to export files");
    } finally {
      setIsExporting(false);
    }
  };

  const loadFiles = async (params = {}) => {
    try {
      await fetchFiles({
        page: params.page || 1,
        limit: 50,
        search: searchQuery,
        mimeType: mimeTypeFilter,
        sortBy,
        sortOrder,
        ...params,
      });
    } catch (error) {
      logger.error("Failed to load files", { error: error.message });
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadFiles({ page: 1 });
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;

    try {
      await deleteFile(selectedFile._id);
      setShowDeleteModal(false);
      setSelectedFile(null);
      logger.info("File deleted by admin", { fileId: selectedFile._id });
    } catch (error) {
      logger.error("Failed to delete file", {
        error: error.message,
        fileId: selectedFile._id,
      });
      alert(error.response?.data?.error || "Failed to delete file");
    }
  };

  const handlePageChange = (newPage) => {
    loadFiles({ page: newPage });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Files size={28} />
            File Management
          </h1>
          <p className={styles.subtitle}>
            View and manage all files in the system
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionButton}
            onClick={() => loadFiles()}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            className={styles.exportButton}
            onClick={handleExportFiles}
            disabled={isExporting || files.length === 0}
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            className={styles.backButton}
            onClick={() => navigate("/admin")}
          >
            <ChevronLeft size={18} />
            Back
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#e3f2fd" }}
          >
            <Files size={24} color="#1976d2" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.totalFiles}</div>
            <div className={styles.statLabel}>Total Files</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#f3e5f5" }}
          >
            <HardDrive size={24} color="#7b1fa2" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {formatFileSize(statistics.totalSize)}
            </div>
            <div className={styles.statLabel}>Total Storage</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#e8f5e9" }}
          >
            <Users size={24} color="#388e3c" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.uniqueOwners}</div>
            <div className={styles.statLabel}>File Owners</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#fff3e0" }}
          >
            <FolderOpen size={24} color="#f57c00" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {formatFileSize(statistics.averageSize)}
            </div>
            <div className={styles.statLabel}>Avg File Size</div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <select
              className={styles.filterSelect}
              value={mimeTypeFilter}
              onChange={(e) => {
                setMimeTypeFilter(e.target.value);
                loadFiles({ page: 1, mimeType: e.target.value });
              }}
            >
              <option value="">All Types</option>
              {availableFileTypes.map((type) => {
                const typeLabels = {
                  image: "Images",
                  video: "Videos",
                  audio: "Audio",
                  "application/pdf": "PDFs",
                  text: "Text",
                  "application/msword": "Word Documents",
                  "application/vnd.ms-excel": "Excel Spreadsheets",
                  "application/vnd.ms-powerpoint": "PowerPoint Presentations",
                  "application/zip": "Archives",
                };
                return (
                  <option key={type} value={type}>
                    {typeLabels[type] || type}
                  </option>
                );
              })}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                loadFiles({ page: 1, sortBy: e.target.value });
              }}
            >
              <option value="uploadedAt">Date Uploaded</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
          </div>

          <button
            className={styles.sortOrderButton}
            onClick={() => {
              const newOrder = sortOrder === "asc" ? "desc" : "asc";
              setSortOrder(newOrder);
              loadFiles({ page: 1, sortOrder: newOrder });
            }}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {loading && !files.length ? (
        <div className={styles.loading}>Loading files...</div>
      ) : files.length === 0 ? (
        <div className={styles.empty}>No files found</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Owner</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const FileTypeIcon = getFileTypeIcon(file.mimeType);
                    return (
                      <tr key={file._id}>
                        <td>
                          <div className={styles.fileNameWrapper}>
                            <div className={styles.fileIcon}>
                              <FileTypeIcon size={20} />
                            </div>
                            <div className={styles.fileDetails}>
                              <div className={styles.fileName}>{file.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.ownerInfo}>
                            <div className={styles.ownerName}>
                              {file.owner?.name || "Unknown User"}
                            </div>
                            <div className={styles.ownerEmail}>
                              {file.owner?.email || "No email available"}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.fileSize}>
                            {formatFileSize(file.size || 0)}
                          </span>
                        </td>
                        <td>
                          <span className={styles.fileTypeBadge}>
                            {getReadableFileType(file.mimeType)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.dateInfo}>
                            <div className={styles.dateMain}>
                              {formatDate(file.uploadedAt || file.createdAt)}
                            </div>
                            {file.uploadedAt && (
                              <div className={styles.dateSubtext}>
                                {new Date(file.uploadedAt).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              onClick={() => {
                                setSelectedFile(file);
                                setShowDeleteModal(true);
                              }}
                              title="Delete File"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filesPagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(filesPagination.page - 1)}
                disabled={filesPagination.page === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <div className={styles.paginationInfo}>
                Page {filesPagination.page} of {filesPagination.totalPages} •{" "}
                {filesPagination.total} total files
              </div>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(filesPagination.page + 1)}
                disabled={filesPagination.page === filesPagination.totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {showDeleteModal && selectedFile && (
        <div className={styles.modal} onClick={() => setShowDeleteModal(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Delete File</h2>
            <p className={styles.modalDescription}>
              Are you sure you want to delete{" "}
              <strong>{selectedFile.name}</strong>?
            </p>
            <p className={styles.modalWarning}>This action cannot be undone.</p>

            <div className={styles.modalActions}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className={`${styles.modalButtonPrimary} ${styles.deleteButtonPrimary}`}
                onClick={confirmDelete}
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManagement;
