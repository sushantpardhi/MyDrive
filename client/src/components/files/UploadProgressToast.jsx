import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { formatFileSize } from "../../utils/formatters";
import styles from "./UploadProgressToast.module.css";

import { useState, useEffect } from "react";

const UploadProgressToast = ({
  isOpen,
  uploadProgress,
  onPauseUpload,
  onResumeUpload,
  onStopUpload,
  onPauseAll,
  onResumeAll,
  onStopAll,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const uploadItems = Object.entries(uploadProgress);
  const hasUploads = uploadItems.length > 0;
  const hasActiveUploads = uploadItems.some(
    ([, upload]) => upload.status === "uploading"
  );

  // Auto-expand when uploads start
  useEffect(() => {
    if (hasActiveUploads) {
      setCollapsed(false);
    }
  }, [hasActiveUploads]);

  if (!isOpen) return null;

  const completedCount = uploadItems.filter(
    ([, upload]) => upload.status === "completed"
  ).length;
  const failedCount = uploadItems.filter(
    ([, upload]) => upload.status === "error"
  ).length;
  const totalCount = uploadItems.length;

  // Sort items: uploading first, then completed, then failed
  const sortedItems = uploadItems.sort(([, a], [, b]) => {
    const statusPriority = { uploading: 0, completed: 1, error: 2 };
    return statusPriority[a.status] - statusPriority[b.status];
  });

  // Calculate overall statistics
  const calculateOverallStats = () => {
    const completedUploads = uploadItems.filter(
      ([, upload]) => upload.status === "completed"
    );

    if (completedUploads.length === 0) return null;

    const totalBytes = completedUploads.reduce(
      (sum, [, upload]) => sum + upload.fileSize,
      0
    );
    const totalTime = completedUploads.reduce(
      (sum, [, upload]) => sum + (upload.totalTime || 0),
      0
    );
    const averageTime = totalTime / completedUploads.length;
    const overallSpeed = totalTime > 0 ? totalBytes / totalTime : 0;

    return {
      totalBytes,
      averageTime,
      overallSpeed,
      totalTime,
    };
  };

  // Calculate current active stats
  const calculateActiveStats = () => {
    if (!hasActiveUploads) return null;

    const allUploads = uploadItems;
    const totalBytes = allUploads.reduce(
      (sum, [, upload]) => sum + upload.fileSize,
      0
    );
    const uploadedBytes = allUploads.reduce(
      (sum, [, upload]) => sum + upload.uploadedBytes,
      0
    );
    const currentSpeeds = allUploads
      .filter(([, upload]) => upload.status === "uploading" && upload.speed > 0)
      .map(([, upload]) => upload.speed);

    const averageCurrentSpeed =
      currentSpeeds.length > 0
        ? currentSpeeds.reduce((sum, speed) => sum + speed, 0) /
          currentSpeeds.length
        : 0;

    const overallProgress =
      totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;

    return {
      totalBytes,
      uploadedBytes,
      averageCurrentSpeed,
      overallProgress,
    };
  };

  const overallStats = calculateOverallStats();
  const activeStats = calculateActiveStats();

  const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond === 0) return "0 B/s";
    return formatFileSize(bytesPerSecond) + "/s";
  };

  const formatTimeRemaining = (bytesRemaining, bytesPerSecond) => {
    if (bytesPerSecond === 0 || bytesRemaining === 0) return "";
    const secondsRemaining = bytesRemaining / bytesPerSecond;

    if (secondsRemaining < 60) {
      return `${Math.ceil(secondsRemaining)}s remaining`;
    } else if (secondsRemaining < 3600) {
      return `${Math.ceil(secondsRemaining / 60)}m remaining`;
    } else {
      return `${Math.ceil(secondsRemaining / 3600)}h remaining`;
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)}m`;
    } else {
      return `${(seconds / 3600).toFixed(1)}h`;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className={styles.statusIcon} />;
      case "error":
        return <AlertCircle className={styles.statusIcon} />;
      default:
        return <Upload className={styles.statusIcon} />;
    }
  };

  // If no uploads, show idle state
  if (!hasUploads) {
    return (
      <div
        className={`${styles.toast} ${styles.idle} ${
          collapsed ? styles.collapsed : ""
        }`}
      >
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Upload size={16} />
            <div className={styles.headerText}>
              <h4>Uploads</h4>
              <div className={styles.overallStats}>
                <span className={styles.statusText}>No active uploads</span>
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={styles.collapseButton}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className={styles.content}>
            <div className={styles.emptyState}>
              <Upload size={32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Upload files to see progress here
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${styles.toast} ${
        !hasActiveUploads ? styles.completed : ""
      } ${collapsed ? styles.collapsed : ""}`}
    >
      <div className={styles.header}>
        <div className={styles.headerContent}>
          {hasActiveUploads ? (
            <Upload size={16} />
          ) : (
            <CheckCircle size={16} className={styles.completedIcon} />
          )}
          <div className={styles.headerText}>
            <h4>
              {hasActiveUploads
                ? `Uploading ${totalCount} file${totalCount !== 1 ? "s" : ""}`
                : `Upload Complete`}
            </h4>
            {hasActiveUploads && activeStats && (
              <div className={styles.activeStats}>
                <span className={styles.statusText}>
                  {formatFileSize(activeStats.uploadedBytes)} /{" "}
                  {formatFileSize(activeStats.totalBytes)} •{" "}
                  {Math.round(activeStats.overallProgress)}%
                </span>
                {activeStats.averageCurrentSpeed > 0 && (
                  <span className={styles.statsInfo}>
                    Current Speed:{" "}
                    {formatSpeed(activeStats.averageCurrentSpeed)}
                  </span>
                )}
                <div className={styles.overallProgressBar}>
                  <div
                    className={styles.overallProgressFill}
                    style={{ width: `${activeStats.overallProgress}%` }}
                  />
                </div>
              </div>
            )}
            {!hasActiveUploads && overallStats && (
              <div className={styles.overallStats}>
                <span className={styles.statusText}>
                  {completedCount} of {totalCount} files uploaded successfully
                  {failedCount > 0 && ` • ${failedCount} failed`}
                </span>
                <span className={styles.statsInfo}>
                  {formatFileSize(overallStats.totalBytes)} • Avg:{" "}
                  {formatSpeed(overallStats.overallSpeed)} •{" "}
                  {formatDuration(overallStats.averageTime)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={styles.collapseButton}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!hasActiveUploads && onClose && (
            <button
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className={styles.content}>
            <div className={styles.uploadList}>
              {sortedItems.map(([fileId, upload]) => {
                const bytesRemaining = upload.fileSize - upload.uploadedBytes;
                const timeRemaining = formatTimeRemaining(
                  bytesRemaining,
                  upload.speed
                );

                return (
                  <div
                    key={fileId}
                    className={styles.uploadItem}
                    data-status={upload.status}
                  >
                    <div className={styles.fileInfo}>
                      <div className={styles.fileHeader}>
                        <div className={styles.fileIcon}>
                          {getStatusIcon(upload.status)}
                        </div>
                        <div className={styles.fileDetails}>
                          <div className={styles.fileName}>
                            {upload.fileName}
                          </div>
                          <div className={styles.uploadStats}>
                            <span className={styles.sizeInfo}>
                              {formatFileSize(upload.uploadedBytes)} /{" "}
                              {formatFileSize(upload.fileSize)}
                            </span>
                            {upload.status === "uploading" && (
                              <>
                                <span className={styles.speed}>
                                  {formatSpeed(upload.speed)}
                                </span>
                                {timeRemaining && (
                                  <span className={styles.timeRemaining}>
                                    {timeRemaining}
                                  </span>
                                )}
                              </>
                            )}
                            {upload.status === "paused" && (
                              <span className={styles.pausedText}>Paused</span>
                            )}
                            {upload.status === "completed" &&
                              upload.finalSpeed && (
                                <>
                                  <span className={styles.completedSpeed}>
                                    Avg: {formatSpeed(upload.finalSpeed)}
                                  </span>
                                  <span className={styles.completedTime}>
                                    {formatDuration(upload.totalTime)}
                                  </span>
                                </>
                              )}
                            {upload.status === "error" && (
                              <span className={styles.errorText}>
                                Upload failed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.uploadItemActions}>
                          {(upload.status === "uploading" ||
                            upload.status === "paused") && (
                            <>
                              {upload.status === "uploading" && (
                                <button
                                  className={styles.actionBtn}
                                  title="Pause"
                                  onClick={() =>
                                    onPauseUpload && onPauseUpload(fileId)
                                  }
                                >
                                  <Pause size={16} />
                                </button>
                              )}
                              {upload.status === "paused" && (
                                <button
                                  className={styles.actionBtn}
                                  title="Resume"
                                  onClick={() =>
                                    onResumeUpload && onResumeUpload(fileId)
                                  }
                                >
                                  <Play size={16} />
                                </button>
                              )}
                              <button
                                className={styles.actionBtn}
                                title="Cancel"
                                onClick={() =>
                                  onStopUpload && onStopUpload(fileId)
                                }
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          {upload.status !== "uploading" &&
                            upload.status !== "paused" && (
                              <div className={styles.progressPercent}>
                                {Math.round(upload.progress)}%
                              </div>
                            )}
                        </div>
                      </div>

                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                          <div
                            className={`${styles.progressFill} ${
                              upload.status === "completed"
                                ? styles.completed
                                : upload.status === "error"
                                ? styles.error
                                : ""
                            }`}
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalCount > 1 && (
            <div className={styles.footer}>
              <div className={styles.summary}>
                {hasActiveUploads ? (
                  <div className={styles.summaryText}>
                    Progress: {completedCount} completed •{" "}
                    {totalCount - completedCount - failedCount} uploading
                    {failedCount > 0 && ` • ${failedCount} failed`}
                  </div>
                ) : overallStats ? (
                  <div className={styles.summaryText}>
                    {failedCount > 0
                      ? "Upload completed with errors"
                      : "All files uploaded"}{" "}
                    • Total: {formatFileSize(overallStats.totalBytes)}
                    {failedCount > 0 && ` • ${failedCount} failed`}
                  </div>
                ) : (
                  <div className={styles.summaryText}>
                    Upload completed{" "}
                    {failedCount > 0
                      ? `with ${failedCount} error${
                          failedCount !== 1 ? "s" : ""
                        }`
                      : ""}
                  </div>
                )}
              </div>
              <div className={styles.collectiveActions}>
                <button
                  className={styles.actionBtn}
                  title="Pause All"
                  onClick={onPauseAll}
                  disabled={!hasActiveUploads}
                >
                  <Pause size={16} /> Pause All
                </button>
                <button
                  className={styles.actionBtn}
                  title="Resume All"
                  onClick={onResumeAll}
                  disabled={uploadItems.every(([, u]) => u.status !== "paused")}
                >
                  <Play size={16} /> Resume All
                </button>
                <button
                  className={styles.actionBtn}
                  title="Stop All"
                  onClick={onStopAll}
                  disabled={
                    !hasActiveUploads &&
                    uploadItems.every(([, u]) => u.status !== "paused")
                  }
                >
                  <X size={16} /> Stop All
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UploadProgressToast;
