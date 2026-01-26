import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
  Download,
  ArrowUpDown,
  Archive,
  Loader2,
  Minimize2,
  Maximize2,
  XCircle,
} from "lucide-react";
import { formatFileSize } from "../../utils/formatters";
import styles from "./TransferProgressToast.module.css";

import { useState, useEffect, useMemo, useCallback } from "react";

const TransferProgressToast = ({
  isOpen,
  uploadProgress,
  downloadProgress = {},
  onStopUpload,
  onCancelDownload,
  onRemoveDownload,
  onStopAll,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  // Responsive breakpoint detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsCompact(window.innerWidth <= 480);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Memoized transfer data processing
  const { uploadItems, downloadItems, allTransferItems, hasTransfers, hasActiveTransfers } = useMemo(() => {
    const uploads = Object.entries(uploadProgress || {});
    const downloads = Object.entries(downloadProgress || {});
    const all = [...uploads, ...downloads];
    const active = all.some(
      ([, transfer]) =>
        transfer.status === "uploading" || 
        transfer.status === "downloading" ||
        transfer.status === "preparing" ||
        transfer.status === "zipping" ||
        transfer.status === "paused"
    );
    return {
      uploadItems: uploads,
      downloadItems: downloads,
      allTransferItems: all,
      hasTransfers: all.length > 0,
      hasActiveTransfers: active,
    };
  }, [uploadProgress, downloadProgress]);

  // Auto-expand when transfers start
  useEffect(() => {
    if (hasActiveTransfers) {
      setCollapsed(false);
    }
  }, [hasActiveTransfers]);

  // Memoized cancel handler
  const handleCancel = useCallback((itemId, isDownload, status) => {
    if (isDownload) {
      // For completed/error/cancelled downloads, just remove from list
      if (status === "completed" || status === "error" || status === "cancelled") {
        onRemoveDownload?.(itemId);
      } else {
        onCancelDownload?.(itemId);
      }
    } else {
      onStopUpload?.(itemId);
    }
  }, [onCancelDownload, onRemoveDownload, onStopUpload]);

  if (!isOpen) return null;

  const completedCount = allTransferItems.filter(
    ([, transfer]) => transfer.status === "completed"
  ).length;
  const failedCount = allTransferItems.filter(
    ([, transfer]) => transfer.status === "error"
  ).length;
  const activeCount = allTransferItems.filter(
    ([, transfer]) =>
      transfer.status === "uploading" ||
      transfer.status === "downloading" ||
      transfer.status === "preparing" ||
      transfer.status === "zipping"
  ).length;
  const totalCount = allTransferItems.length;

  // Sort items: active first (uploading/downloading), then preparing, then completed, then failed
  const sortedItems = [...allTransferItems].sort(([, a], [, b]) => {
    const statusPriority = {
      uploading: 0,
      downloading: 0,
      preparing: 1,
      zipping: 1,
      cancelling: 2,
      completed: 3,
      cancelled: 4,
      error: 5,
    };
    return (statusPriority[a.status] ?? 6) - (statusPriority[b.status] ?? 6);
  });

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const completedTransfers = allTransferItems.filter(
      ([, transfer]) => transfer.status === "completed"
    );

    if (completedTransfers.length === 0) return null;

    const totalBytes = completedTransfers.reduce(
      (sum, [, transfer]) => sum + (transfer.fileSize || 0),
      0
    );
    const totalTime = completedTransfers.reduce(
      (sum, [, transfer]) => sum + (transfer.totalTime || 0),
      0
    );
    const averageTime = totalTime / completedTransfers.length;
    const overallSpeed = totalTime > 0 ? totalBytes / totalTime : 0;

    return {
      totalBytes,
      averageTime,
      overallSpeed,
      totalTime,
    };
  }, [allTransferItems]);

  // Calculate current active stats
  const activeStats = useMemo(() => {
    if (!hasActiveTransfers) return null;

    const allTransfers = allTransferItems;
    const totalBytes = allTransfers.reduce(
      (sum, [, transfer]) => sum + (transfer.fileSize || 0),
      0
    );
    const uploadedBytes = allTransfers.reduce(
      (sum, [, transfer]) => sum + (transfer.uploadedBytes || 0),
      0
    );
    const currentSpeeds = allTransfers
      .filter(
        ([, transfer]) =>
          (transfer.status === "uploading" ||
            transfer.status === "downloading") &&
          transfer.speed > 0
      )
      .map(([, transfer]) => transfer.speed);

    const averageCurrentSpeed =
      currentSpeeds.length > 0
        ? currentSpeeds.reduce((sum, speed) => sum + speed, 0) /
          currentSpeeds.length
        : 0;

    const overallProgress =
      totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;

    // Count items in different phases
    const preparingCount = allTransfers.filter(
      ([, transfer]) => transfer.status === "preparing"
    ).length;
    const zippingCount = allTransfers.filter(
      ([, transfer]) => transfer.status === "zipping"
    ).length;

    return {
      totalBytes,
      uploadedBytes,
      averageCurrentSpeed,
      overallProgress,
      preparingCount,
      zippingCount,
    };
  }, [allTransferItems, hasActiveTransfers]);

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

  const getStatusIcon = (status, type = "upload", phase = null) => {
    switch (status) {
      case "completed":
        return <CheckCircle className={`${styles.statusIcon} ${styles.successIcon}`} />;
      case "error":
        return <AlertCircle className={`${styles.statusIcon} ${styles.errorIcon}`} />;
      case "cancelled":
        return <XCircle className={`${styles.statusIcon} ${styles.cancelledIcon}`} />;
      case "paused":
        return <Pause className={`${styles.statusIcon} ${styles.pausedIcon}`} />;
      case "preparing":
        return (
          <Loader2 className={`${styles.statusIcon} ${styles.spinning}`} />
        );
      case "zipping":
        return <Archive className={`${styles.statusIcon} ${styles.pulsing}`} />;
      case "cancelling":
        return <Loader2 className={`${styles.statusIcon} ${styles.spinning} ${styles.cancellingIcon}`} />;
      case "downloading":
        return <Download className={`${styles.statusIcon} ${styles.activeIcon}`} />;
      default:
        return <Upload className={`${styles.statusIcon} ${styles.activeIcon}`} />;
    }
  };

  const getStatusText = (status, phase, fileName) => {
    if (status === "preparing") {
      return "Preparing...";
    }
    if (status === "zipping" || phase === "zipping") {
      return "Zipping...";
    }
    if (status === "downloading") {
      return "Downloading...";
    }
    if (status === "uploading") {
      return "Uploading...";
    }
    if (status === "cancelling") {
      return "Cancelling...";
    }
    if (status === "cancelled") {
      return "Cancelled";
    }
    if (status === "completed") {
      return "Completed";
    }
    if (status === "error") {
      return "Failed";
    }
    if (status === "paused") {
      return "Paused";
    }
    return "";
  };

  // If no transfers, show idle state
  if (!hasTransfers) {
    return (
      <div
        className={`${styles.toast} ${styles.idle} ${
          collapsed ? styles.collapsed : ""
        } ${isMobile ? styles.mobile : ""} ${isCompact ? styles.compact : ""}`}
      >
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIconWrapper}>
              <ArrowUpDown size={isMobile ? 14 : 16} />
            </div>
            <div className={styles.headerText}>
              <h4>Transfers</h4>
              <div className={styles.overallStats}>
                <span className={styles.statusText}>No active transfers</span>
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
              <ArrowUpDown size={isMobile ? 28 : 32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                {isMobile ? "Start a transfer to see progress" : "Upload or download files to see progress here"}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Get header title based on state
  const getHeaderTitle = () => {
    if (!hasActiveTransfers) {
      return isCompact ? "Complete" : "Transfer Complete";
    }
    if (isCompact) {
      return `${activeCount} active`;
    }
    if (isMobile) {
      return `${totalCount} item${totalCount !== 1 ? "s" : ""}`;
    }
    return `Transferring ${totalCount} item${totalCount !== 1 ? "s" : ""}`;
  };

  return (
    <div
      className={`${styles.toast} ${
        !hasActiveTransfers ? styles.completed : ""
      } ${collapsed ? styles.collapsed : ""} ${isMobile ? styles.mobile : ""} ${isCompact ? styles.compact : ""}`}
    >
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerIconWrapper}>
            {hasActiveTransfers ? (
              <ArrowUpDown size={isMobile ? 14 : 16} className={styles.activeIconAnim} />
            ) : (
              <CheckCircle size={isMobile ? 14 : 16} className={styles.completedIcon} />
            )}
          </div>
          <div className={styles.headerText}>
            <h4>{getHeaderTitle()}</h4>
            <div className={styles.badgesRow}>
              {hasActiveTransfers &&
                activeStats &&
                activeStats.preparingCount > 0 && (
                  <span className={styles.preparingBadge}>
                    {activeStats.preparingCount} preparing
                  </span>
                )}
              {hasActiveTransfers &&
                activeStats &&
                activeStats.zippingCount > 0 && (
                  <span className={styles.zippingBadge}>
                    {activeStats.zippingCount} zipping
                  </span>
                )}
            </div>
            {hasActiveTransfers && activeStats && (
              <div className={styles.activeStats}>
                <span className={styles.statusText}>
                  {formatFileSize(activeStats.uploadedBytes)} /{" "}
                  {formatFileSize(activeStats.totalBytes)}
                  {!isCompact && ` • ${Math.round(activeStats.overallProgress)}%`}
                </span>
                {activeStats.averageCurrentSpeed > 0 && !isCompact && (
                  <span className={styles.statsInfo}>
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
            {!hasActiveTransfers && overallStats && (
              <div className={styles.overallStats}>
                <span className={styles.statusText}>
                  {completedCount}/{totalCount} completed
                  {failedCount > 0 && ` • ${failedCount} failed`}
                </span>
                {!isCompact && (
                  <span className={styles.statsInfo}>
                    {formatFileSize(overallStats.totalBytes)} • {formatDuration(overallStats.averageTime)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {hasActiveTransfers && onStopAll && totalCount > 1 && !isMobile && (
            <button
              onClick={onStopAll}
              className={styles.stopAllButton}
              aria-label="Stop all transfers"
              title="Stop all"
            >
              <XCircle size={14} />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={styles.collapseButton}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          {!hasActiveTransfers && onClose && (
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
              {sortedItems.map(([itemId, transfer]) => {
                const bytesRemaining =
                  (transfer.fileSize || 0) - (transfer.uploadedBytes || 0);
                const timeRemaining = formatTimeRemaining(
                  bytesRemaining,
                  transfer.speed || 0
                );
                const isDownload = transfer.type === "download";
                const phase = transfer.phase || transfer.status;

                return (
                  <div
                    key={itemId}
                    className={`${styles.uploadItem} ${
                      phase === "preparing" || phase === "zipping"
                        ? styles.preparing
                        : ""
                    }`}
                    data-status={transfer.status}
                    data-phase={phase}
                  >
                    <div className={styles.fileInfo}>
                      <div className={styles.fileHeader}>
                        <div className={`${styles.fileIcon} ${styles[`icon_${transfer.status}`] || ""}`}>
                          {getStatusIcon(transfer.status, transfer.type, phase)}
                        </div>
                        <div className={styles.fileDetails}>
                          <div className={styles.fileName} title={transfer.fileName}>
                            {transfer.fileName}
                          </div>
                          <div className={styles.uploadStats}>
                            {/* Show different info based on phase */}
                            {phase === "preparing" && (
                              <span className={styles.statusLabel}>
                                {getStatusText(transfer.status, phase, transfer.fileName)}
                              </span>
                            )}

                            {phase === "zipping" && (
                              <>
                                <span className={styles.statusLabel}>
                                  {getStatusText(transfer.status, phase, transfer.fileName)}
                                </span>
                                {transfer.totalFiles > 1 && !isCompact && (
                                  <span className={styles.filesInfo}>
                                    {transfer.filesProcessed || 0}/{transfer.totalFiles}
                                  </span>
                                )}
                              </>
                            )}

                            {(phase === "uploading" || phase === "downloading") && (
                              <>
                                <span className={styles.sizeInfo}>
                                  {isCompact
                                    ? `${Math.round((transfer.progress || 0))}%`
                                    : `${formatFileSize(transfer.uploadedBytes || 0)} / ${
                                        transfer.fileSize > 0
                                          ? formatFileSize(transfer.fileSize)
                                          : "?"
                                      }`}
                                </span>
                                {transfer.speed > 0 && !isCompact && (
                                  <span className={styles.speed}>
                                    {formatSpeed(transfer.speed)}
                                  </span>
                                )}
                                {timeRemaining && transfer.fileSize > 0 && !isMobile && (
                                  <span className={styles.timeRemaining}>
                                    {timeRemaining}
                                  </span>
                                )}
                              </>
                            )}
                            {transfer.status === "paused" && (
                              <span className={styles.pausedText}>Paused</span>
                            )}
                            {transfer.status === "cancelling" && (
                              <span className={styles.cancellingText}>
                                Cancelling...
                              </span>
                            )}
                            {transfer.status === "cancelled" && (
                              <span className={styles.cancelledText}>
                                Cancelled
                              </span>
                            )}
                            {transfer.status === "completed" && (
                              <>
                                {transfer.finalSpeed && !isCompact && (
                                  <span className={styles.completedSpeed}>
                                    {formatSpeed(transfer.finalSpeed)}
                                  </span>
                                )}
                                {transfer.totalTime && (
                                  <span className={styles.completedTime}>
                                    {formatDuration(transfer.totalTime)}
                                  </span>
                                )}
                                {transfer.totalFiles > 1 && !isCompact && (
                                  <span className={styles.filesInfo}>
                                    {transfer.totalFiles} files
                                  </span>
                                )}
                              </>
                            )}
                            {transfer.status === "error" && (
                              <span className={styles.errorText}>
                                {isCompact ? "Failed" : isDownload ? "Download failed" : "Upload failed"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.uploadItemActions}>
                          {/* Cancel button - for active transfers */}
                          {(transfer.status === "uploading" ||
                            transfer.status === "downloading" ||
                            transfer.status === "preparing" ||
                            transfer.status === "zipping" ||
                            transfer.status === "paused" ||
                            transfer.status === "cancelling") && (
                            <button
                              className={`${styles.actionBtn} ${styles.cancelBtn}`}
                              title={transfer.status === "cancelling" ? "Cancelling..." : "Cancel"}
                              onClick={() => {
                                if (transfer.status === "cancelling") return;
                                handleCancel(itemId, isDownload, transfer.status);
                              }}
                              disabled={transfer.status === "cancelling"}
                            >
                              <X size={14} />
                            </button>
                          )}
                          
                          {/* Remove button - for completed/error/cancelled transfers */}
                          {(transfer.status === "completed" ||
                            transfer.status === "error" ||
                            transfer.status === "cancelled") && (
                            <button
                              className={`${styles.actionBtn} ${styles.removeBtn}`}
                              title="Remove"
                              onClick={() => handleCancel(itemId, isDownload, transfer.status)}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={styles.progressContainer}>
                        <div
                          className={`${styles.progressBar} ${
                            (phase === "preparing" || phase === "zipping") &&
                            transfer.fileSize === 0
                              ? styles.indeterminate
                              : ""
                          }`}
                        >
                          <div
                            className={`${styles.progressFill} ${
                              transfer.status === "completed"
                                ? styles.completed
                                : transfer.status === "error"
                                ? styles.error
                                : transfer.status === "cancelled"
                                ? styles.cancelled
                                : transfer.status === "paused"
                                ? styles.paused
                                : phase === "preparing" || phase === "zipping"
                                ? styles.preparing
                                : ""
                            }`}
                            style={{
                              width:
                                phase === "zipping" && transfer.zippingProgress
                                  ? `${transfer.zippingProgress}%`
                                  : phase === "preparing" ||
                                    (phase === "zipping" && !transfer.zippingProgress)
                                  ? "100%"
                                  : `${transfer.progress || 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalCount > 1 && !isCompact && (
            <div className={styles.footer}>
              <div className={styles.summary}>
                {hasActiveTransfers ? (
                  <div className={styles.summaryText}>
                    {completedCount} done • {activeCount} active
                    {failedCount > 0 && ` • ${failedCount} failed`}
                  </div>
                ) : overallStats ? (
                  <div className={styles.summaryText}>
                    {failedCount > 0 ? "Completed with errors" : "All transfers complete"}
                    {!isMobile && ` • ${formatFileSize(overallStats.totalBytes)}`}
                  </div>
                ) : (
                  <div className={styles.summaryText}>
                    Complete {failedCount > 0 && `• ${failedCount} error${failedCount !== 1 ? "s" : ""}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransferProgressToast;
