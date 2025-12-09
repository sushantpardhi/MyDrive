import styles from "./OwnerAvatar.module.css";
import { getUserInitials, getAvatarColor } from "../../utils/helpers";

const OwnerAvatar = ({ owner, size = "default", className = "" }) => {
  if (!owner) return null;

  const ownerName = typeof owner === "object" ? owner.name : owner;
  const ownerEmail = typeof owner === "object" ? owner.email : "";

  const initials = getUserInitials(ownerName);
  const backgroundColor = getAvatarColor(ownerName);
  const sizeClass = size === "compact" ? styles.compact : "";

  return (
    <div
      className={`${styles.ownerAvatar} ${sizeClass} ${className}`}
      title={`Owner: ${ownerName}`}
    >
      <div className={styles.avatar} aria-label={`Owned by ${ownerName}`}>
        <div className={styles.avatarPlaceholder} style={{ backgroundColor }}>
          {initials}
        </div>
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
