import { useGuest } from "../../contexts/GuestContext";
import { useState, useEffect, useRef } from "react";
import styles from "./GuestBanner.module.css";

const GuestBanner = () => {
  const {
    isTemporaryGuest,
    formattedTime,
    canExtend,
    extensionsLeft,
    showExpiryWarning,
    setShowExpiryWarning,
    setShowConvertModal,
    extendSession,
    sessionExpired,
    cleanupGuestSession,
  } = useGuest();

  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState("");
  const bannerRef = useRef(null);

  // Set CSS variable for guest banner height
  useEffect(() => {
    if (isTemporaryGuest && bannerRef.current) {
      const height = bannerRef.current.offsetHeight;
      document.documentElement.style.setProperty(
        "--guest-banner-height",
        `${height}px`,
      );
    } else {
      document.documentElement.style.setProperty(
        "--guest-banner-height",
        "0px",
      );
    }

    return () => {
      document.documentElement.style.setProperty(
        "--guest-banner-height",
        "0px",
      );
    };
  }, [isTemporaryGuest]);

  if (!isTemporaryGuest) {
    return null;
  }

  const handleExtend = async () => {
    setExtending(true);
    setExtendError("");
    const result = await extendSession();
    setExtending(false);

    if (!result.success) {
      setExtendError(result.error);
    } else {
      setShowExpiryWarning(false);
    }
  };

  const handleCreateAccount = () => {
    setShowConvertModal(true);
  };

  // Parse time to check if warning state (< 5 mins)
  const timeParts = formattedTime.split(":");
  const minutes = parseInt(timeParts[0], 10);
  const isLowTime = minutes < 5;

  return (
    <>
      <div
        ref={bannerRef}
        className={`${styles.banner} ${isLowTime ? styles.warning : ""}`}
      >
        <div className={styles.content}>
          <div className={styles.info}>
            <span className={styles.icon}>⏱️</span>
            <span className={styles.text}>
              Guest session:{" "}
              <strong className={isLowTime ? styles.urgentTime : ""}>
                {formattedTime}
              </strong>{" "}
              remaining
            </span>
          </div>

          <div className={styles.actions}>
            {canExtend && extensionsLeft > 0 && (
              <button
                className={styles.extendButton}
                onClick={handleExtend}
                disabled={extending}
                title={`${extensionsLeft} extension${extensionsLeft !== 1 ? "s" : ""} left`}
              >
                {extending ? "Extending..." : `Extend (+15 min)`}
              </button>
            )}
            <button
              className={styles.createAccountButton}
              onClick={handleCreateAccount}
            >
              Create Account
            </button>
          </div>
        </div>

        {extendError && <div className={styles.error}>{extendError}</div>}
      </div>

      {/* Expiry Warning Modal */}
      {showExpiryWarning && (
        <div
          className={styles.warningOverlay}
          onClick={() => setShowExpiryWarning(false)}
        >
          <div
            className={styles.warningModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.warningIcon}>⚠️</div>
            <h3>Session Expiring Soon</h3>
            <p>
              Your guest session will expire in {formattedTime}.
              {canExtend && extensionsLeft > 0
                ? " Would you like to extend your session or create an account to save your files?"
                : " Create an account now to save your files."}
            </p>
            <div className={styles.warningActions}>
              {canExtend && extensionsLeft > 0 && (
                <button
                  className={styles.extendButton}
                  onClick={handleExtend}
                  disabled={extending}
                >
                  {extending ? "Extending..." : "Extend Session"}
                </button>
              )}
              <button
                className={styles.createAccountButton}
                onClick={handleCreateAccount}
              >
                Create Account
              </button>
              <button
                className={styles.dismissButton}
                onClick={() => setShowExpiryWarning(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Expired Modal */}
      {sessionExpired && (
        <div className={styles.warningOverlay} style={{ zIndex: 10001 }}>
          <div className={styles.warningModal}>
            <div className={styles.warningIcon}>🛑</div>
            <h3>Session Expired</h3>
            <p>
              Your guest session has ended. All temporary files will be deleted.
            </p>
            <div className={styles.warningActions}>
              <button
                className={styles.createAccountButton}
                onClick={handleCreateAccount}
              >
                Create Account to Save Files
              </button>
              <button
                className={styles.dismissButton}
                onClick={cleanupGuestSession}
              >
                Dismiss & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuestBanner;
