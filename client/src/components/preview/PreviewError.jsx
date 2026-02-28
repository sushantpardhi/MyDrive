import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import styles from "./PreviewModal.module.css";

const PreviewError = ({ error, onRetry, onDownload, fileName }) => (
  <div className={styles.errorState}>
    <AlertTriangle size={48} className={styles.errorIcon} />
    <h3 className={styles.errorTitle}>Preview Unavailable</h3>
    <p className={styles.errorMessage}>
      {error || "Failed to load file preview. Please try again."}
    </p>
    <div className={styles.errorActions}>
      {onRetry && (
        <button className={styles.retryButton} onClick={onRetry}>
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
      {onDownload && (
        <button className={styles.downloadButton} onClick={onDownload}>
          <Download size={16} />
          Download {fileName || "File"}
        </button>
      )}
    </div>
  </div>
);

export default PreviewError;
