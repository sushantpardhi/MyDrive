import React, { useEffect } from "react";
import styles from "./DevelopmentBanner.module.css";

const DevelopmentBanner = () => {
  // Show in local development OR when explicitly enabled via REACT_APP_SHOW_DEV_BANNER
  const showBanner = process.env.NODE_ENV === "development" || process.env.REACT_APP_SHOW_DEV_BANNER === "true";
  
  useEffect(() => {
    // Set or remove the CSS variable based on whether banner is shown
    if (showBanner) {
      document.documentElement.style.setProperty('--dev-banner-height', '34px');
    } else {
      document.documentElement.style.setProperty('--dev-banner-height', '0px');
    }
    
    // Cleanup on unmount
    return () => {
      document.documentElement.style.setProperty('--dev-banner-height', '0px');
    };
  }, [showBanner]);
  
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
