import React from "react";
import styles from "./DevelopmentBanner.module.css";

const DevelopmentBanner = () => {
  // Show in local development OR when explicitly enabled via REACT_APP_SHOW_DEV_BANNER
  const showBanner = process.env.REACT_APP_SHOW_DEV_BANNER === "true";
  
  if (!showBanner) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.text}>Development Mode</span>
        <span className={styles.badge}>DEV</span>
      </div>
    </div>
  );
};

export default DevelopmentBanner;
