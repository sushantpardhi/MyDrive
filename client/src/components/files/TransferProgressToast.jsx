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
} from "lucide-react";
import { formatFileSize } from "../../utils/formatters";
import styles from "./TransferProgressToast.module.css";

import { useState, useEffect } from "react";

const TransferProgressToast = ({
  isOpen,
  uploadProgress,
  downloadProgress = {},
  onStopUpload,
  onCancelDownload,
  onStopAll,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const uploadItems = Object.entries(uploadProgress);
  const downloadItems = Object.entries(downloadProgress);
  const allTransferItems = [...uploadItems, ...downloadItems];
  const hasTransfers = allTransferItems.length > 0;
  const hasActiveTransfers = allTransferItems.some(
    ([, transfer]) =>
      transfer.status === "uploading" || transfer.status === "downloading"
  );

  // Auto-expand when transfers start
  useEffect(() => {
    if (hasActiveTransfers) {
      setCollapsed(false);
    }
  }, [hasActiveTransfers]);

  if (!isOpen) return null;

  const completedCount = allTransferItems.filter(
    ([, transfer]) => transfer.status === "completed"
  ).length;
  const failedCount = allTransferItems.filter(
    ([, transfer]) => transfer.status === "error"
  ).length;
  const totalCount = allTransferItems.length;

  // Sort items: active first (uploading/downloading), then completed, then failed
  const sortedItems = allTransferItems.sort(([, a], [, b]) => {
    const statusPriority = {
      uploading: 0,
      downloading: 0,
      cancelling: 1,
      completed: 2,
      cancelled: 3,
      error: 4,
    };
    return statusPriority[a.status] - statusPriority[b.status];
  });

  // Calculate overall statistics
  const calculateOverallStats = () => {
    const completedTransfers = allTransferItems.filter(
      ([, transfer]) => transfer.status === "completed"
    );

    if (completedTransfers.length === 0) return null;

    const totalBytes = completedTransfers.reduce(
      (sum, [, transfer]) => sum + transfer.fileSize,
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
  };

  // Calculate current active stats
  const calculateActiveStats = () => {
    if (!hasActiveTransfers) return null;

    const allTransfers = allTransferItems;
    const totalBytes = allTransfers.reduce(
      (sum, [, transfer]) => sum + transfer.fileSize,
      0
    );
    const uploadedBytes = allTransfers.reduce(
      (sum, [, transfer]) => sum + transfer.uploadedBytes,
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

  const getStatusIcon = (status, type = "upload", phase = null) => {
    switch (status) {
      case "completed":
        return <CheckCircle className={styles.statusIcon} />;
      case "error":
        return <AlertCircle className={styles.statusIcon} />;
      case "preparing":
        return (
          <Loader2 className={`${styles.statusIcon} ${styles.spinning}`} />
        );
      case "zipping":
        return <Archive className={`${styles.statusIcon} ${styles.pulsing}`} />;
      case "downloading":
        return <Download className={styles.statusIcon} />;
      default:
        return <Upload className={styles.statusIcon} />;
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
        }`}
      >
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <ArrowUpDown size={16} />
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
              <ArrowUpDown size={32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Upload or download files to see progress here
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
        !hasActiveTransfers ? styles.completed : ""
      } ${collapsed ? styles.collapsed : ""}`}
    >
      <div className={styles.header}>
        <div className={styles.headerContent}>
          {hasActiveTransfers ? (
            <ArrowUpDown size={16} className={styles.activeIcon} />
          ) : (
            <CheckCircle size={16} className={styles.completedIcon} />
          )}
          <div className={styles.headerText}>
            <h4>
              {hasActiveTransfers
                ? `Transferring ${totalCount} item${
                    totalCount !== 1 ? "s" : ""
                  }`
                : `Transfer Complete`}
            </h4>
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
            {hasActiveTransfers && activeStats && (
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
            {!hasActiveTransfers && overallStats && (
              <div className={styles.overallStats}>
                <span className={styles.statusText}>
                  {completedCount} of {totalCount} items transferred
                  successfully
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
                  transfer.fileSize - transfer.uploadedBytes;
                const timeRemaining = formatTimeRemaining(
                  bytesRemaining,
                  transfer.speed
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
                        <div className={styles.fileIcon}>
                          {getStatusIcon(transfer.status, transfer.type, phase)}
                        </div>
                        <div className={styles.fileDetails}>
                          <div className={styles.fileName}>
                            {transfer.fileName}
                          </div>
                          <div className={styles.uploadStats}>
                            {/* Show different info based on phase */}
                            {phase === "preparing" && (
                              <span className={styles.statusLabel}>
                                {getStatusText(
                                  transfer.status,
                                  phase,
                                  transfer.fileName
                                )}
                              </span>
                            )}

                            {phase === "zipping" && (
                              <>
                                <span className={styles.statusLabel}>
                                  {getStatusText(
                                    transfer.status,
                                    phase,
                                    transfer.fileName
                                  )}
                                </span>
                                {transfer.totalFiles > 1 && (
                                  <span className={styles.filesInfo}>
                                    {transfer.filesProcessed || 0} /{" "}
                                    {transfer.totalFiles} files
                                  </span>
                                )}
                              </>
                            )}

                            {(phase === "uploading" ||
                              phase === "downloading") && (
                              <>
                                <span className={styles.sizeInfo}>
                                  {formatFileSize(transfer.uploadedBytes)} /{" "}
                                  {transfer.fileSize > 0
                                    ? formatFileSize(transfer.fileSize)
                                    : "Unknown"}
                                </span>
                                {transfer.speed > 0 && (
                                  <span className={styles.speed}>
                                    {formatSpeed(transfer.speed)}
                                  </span>
                                )}
                                {timeRemaining && transfer.fileSize > 0 && (
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
                                {transfer.finalSpeed && (
                                  <span className={styles.completedSpeed}>
                                    Avg: {formatSpeed(transfer.finalSpeed)}
                                  </span>
                                )}
                                {transfer.totalTime && (
                                  <span className={styles.completedTime}>
                                    {formatDuration(transfer.totalTime)}
                                  </span>
                                )}
                                {transfer.totalFiles > 1 && (
                                  <span className={styles.filesInfo}>
                                    {transfer.totalFiles} files
                                  </span>
                                )}
                              </>
                            )}
                            {transfer.status === "error" && (
                              <span className={styles.errorText}>
                                {isDownload
                                  ? "Download failed"
                                  : "Upload failed"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.uploadItemActions}>
                          {(transfer.status === "uploading" ||
                            transfer.status === "downloading" ||
                            transfer.status === "cancelling") && (
                            <button
                              className={styles.actionBtn}
                              title={
                                transfer.status === "cancelling"
                                  ? "Cancelling..."
                                  : "Cancel"
                              }
                              onClick={() => {
                                if (transfer.status === "cancelling") return;
                                if (isDownload) {
                                  onCancelDownload && onCancelDownload(itemId);
                                } else {
                                  onStopUpload && onStopUpload(itemId);
                                }
                              }}
                              disabled={transfer.status === "cancelling"}
                            >
                              <X size={16} />
                            </button>
                          )}
                          {(transfer.status === "completed" ||
                            transfer.status === "error" ||
                            transfer.status === "cancelled") && (
                            <button
                              className={styles.actionBtn}
                              title="Remove"
                              onClick={() => {
                                if (isDownload) {
                                  onCancelDownload && onCancelDownload(itemId);
                                } else {
                                  onStopUpload && onStopUpload(itemId);
                                }
                              }}
                            >
                              <X size={16} />
                            </button>
                          )}
                          {transfer.status !== "uploading" &&
                            transfer.status !== "downloading" &&
                            transfer.status !== "cancelling" &&
                            transfer.status !== "completed" &&
                            transfer.status !== "error" &&
                            transfer.status !== "cancelled" && (
                              <div className={styles.progressPercent}>
                                {Math.round(transfer.progress)}%
                              </div>
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
                                : phase === "preparing" || phase === "zipping"
                                ? styles.preparing
                                : ""
                            }`}
                            style={{
                              width:
                                phase === "zipping" && transfer.zippingProgress
                                  ? `${transfer.zippingProgress}%`
                                  : phase === "preparing" ||
                                    (phase === "zipping" &&
                                      !transfer.zippingProgress)
                                  ? "100%"
                                  : `${transfer.progress}%`,
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

          {totalCount > 1 && (
            <div className={styles.footer}>
              <div className={styles.summary}>
                {hasActiveTransfers ? (
                  <div className={styles.summaryText}>
                    Progress: {completedCount} completed •{" "}
                    {totalCount - completedCount - failedCount} transferring
                    {failedCount > 0 && ` • ${failedCount} failed`}
                  </div>
                ) : overallStats ? (
                  <div className={styles.summaryText}>
                    {failedCount > 0
                      ? "Transfer completed with errors"
                      : "All transfers completed"}{" "}
                    • Total: {formatFileSize(overallStats.totalBytes)}
                    {failedCount > 0 && ` • ${failedCount} failed`}
                  </div>
                ) : (
                  <div className={styles.summaryText}>
                    Transfer completed{" "}
                    {failedCount > 0
                      ? `with ${failedCount} error${
                          failedCount !== 1 ? "s" : ""
                        }`
                      : ""}
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
