import { Loader } from "lucide-react";
import styles from "./PreviewModal.module.css";

const PreviewLoading = ({ message = "Loading preview..." }) => (
  <div className={styles.loadingState}>
    <div className={styles.loadingSpinner}>
      <Loader size={40} className={styles.spinnerIcon} />
    </div>
    <p className={styles.loadingMessage}>{message}</p>
  </div>
);

export default PreviewLoading;
