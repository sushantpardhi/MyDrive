import React from "react";
import styles from "./OwnerAvatar.module.css";

const OwnerAvatar = ({ owner, size = "default", className = "" }) => {
  if (!owner) return null;

  // Get initials from owner name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate a consistent color based on the owner's name
  const getAvatarColor = (name) => {
    if (!name) return "hsl(0, 0%, 70%)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const ownerName = typeof owner === "object" ? owner.name : owner;
  const ownerEmail = typeof owner === "object" ? owner.email : "";
  const initials = getInitials(ownerName);
  const backgroundColor = getAvatarColor(ownerName);

  const sizeClass = size === "compact" ? styles.compact : "";

  return (
    <div
      className={`${styles.ownerAvatar} ${sizeClass} ${className}`}
      title={`Owner: ${ownerName}`}
    >
      <div
        className={styles.avatar}
        style={{ backgroundColor }}
        aria-label={`Owned by ${ownerName}`}
      >
        {initials}
      </div>
      <div className={styles.tooltip}>
        <div className={styles.tooltipContent}>
          <div className={styles.tooltipName}>{ownerName}</div>
          {ownerEmail && (
            <div className={styles.tooltipEmail}>{ownerEmail}</div>
          )}
          <div className={styles.tooltipLabel}>Owner</div>
        </div>
      </div>
    </div>
  );
};

export default OwnerAvatar;
