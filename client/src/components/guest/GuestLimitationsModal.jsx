import { useGuest } from "../../contexts/GuestContext";
import styles from "./GuestLimitationsModal.module.css";
import { AlertCircle, X } from "lucide-react";

const GuestLimitationsModal = () => {
  const { showLimitationsModal, setShowLimitationsModal, setShowConvertModal } =
    useGuest();

  if (!showLimitationsModal) {
    return null;
  }

  const handleClose = () => {
    setShowLimitationsModal(false);
  };

  const handleCreateAccount = () => {
    setShowLimitationsModal(false);
    setShowConvertModal(true);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>

        <div className={styles.header}>
          <div className={styles.icon}>
            <AlertCircle size={48} />
          </div>
          <h2>Guest Session Limitations</h2>
          <p>You're using a temporary guest account with limited features</p>
        </div>

        <div className={styles.content}>
          <div className={styles.limitationsSection}>
            <h3>What you cannot do as a guest:</h3>
            <ul className={styles.limitationsList}>
              <li>
                <X size={16} className={styles.limitIcon} />
                <span>Share files or folders with other users</span>
              </li>
              <li>
                <X size={16} className={styles.limitIcon} />
                <span>Access files after your session expires</span>
              </li>
              <li>
                <X size={16} className={styles.limitIcon} />
                <span>Permanently store your files</span>
              </li>
              <li>
                <X size={16} className={styles.limitIcon} />
                <span>Extend your session indefinitely</span>
              </li>
            </ul>
          </div>

          <div className={styles.infoBox}>
            <p>
              <strong>⏰ Your session is temporary</strong>
            </p>
            <p>
              All files will be deleted when your session expires. Create a free
              account to save your files permanently.
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.continueButton} onClick={handleClose}>
            Continue as Guest
          </button>
          <button className={styles.createButton} onClick={handleCreateAccount}>
            Create Free Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestLimitationsModal;
