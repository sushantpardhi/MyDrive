import React from "react";
import styles from "./LoadingSpinner.module.css";

const LoadingSpinner = ({
  size = "medium",
  fullscreen = false,
  message = null,
  overlay = false,
}) => {
  const sizeClass = styles[size] || styles.medium;

  if (fullscreen) {
    return (
      <div className={styles.fullscreenContainer}>
        <div className={styles.spinnerWrapper}>
          <div className={`${styles.spinner} ${sizeClass}`}>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerCore}></div>
          </div>
          {message && <div className={styles.message}>{message}</div>}
        </div>
      </div>
    );
  }

  if (overlay) {
    return (
      <div className={styles.overlayContainer}>
        <div className={styles.spinnerWrapper}>
          <div className={`${styles.spinner} ${sizeClass}`}>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerCore}></div>
          </div>
          {message && <div className={styles.message}>{message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.spinner} ${sizeClass}`}>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerCore}></div>
      </div>
      {message && <div className={styles.message}>{message}</div>}
    </div>
  );
};

export default LoadingSpinner;
