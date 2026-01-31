import { Link, useLocation } from "react-router-dom";
import { Home, Share2, Trash2, HardDrive, X, Shield } from "lucide-react";
import styles from "./Sidebar.module.css";
import { useState, useEffect } from "react";
import api from "../../services/api";
import { formatFileSize } from "../../utils/formatters";
import { getUserInitials, getAvatarColor } from "../../utils/helpers";
import logger from "../../utils/logger";
import { useUIContext, useAuth } from "../../contexts";

const Sidebar = ({ onClose }) => {
  const location = useLocation();
  const { storageRefreshTrigger } = useUIContext();
  const { user } = useAuth();

  const mainMenu = [
    { name: "My Drive", icon: <Home size={18} />, path: "/drive" },
    { name: "Shared with me", icon: <Share2 size={18} />, path: "/shared" },
    { name: "Trash", icon: <Trash2 size={18} />, path: "/trash" },
  ];

  const [storage, setStorage] = useState({ used: 0, total: 0 });

  useEffect(() => {
    // Fetch storage info from backend
    async function getStorageInfo() {
      try {
        logger.debug("Fetching storage statistics from backend");
        const response = await api.getStorageStats();

        const { storageUsed, storageLimit } = response.data;

        setStorage({
          used: storageUsed,
          total: storageLimit,
        });

        logger.info("Storage statistics loaded", {
          used: storageUsed,
          limit: storageLimit,
          isUnlimited: storageLimit === -1,
          usedFormatted: formatFileSize(storageUsed),
          limitFormatted:
            storageLimit === -1 ? "Unlimited" : formatFileSize(storageLimit),
        });
      } catch (error) {
        logger.error("Failed to fetch storage statistics", {
          error: error.message,
          response: error.response?.data,
        });

        // Set default values on error
        setStorage({
          used: 0,
          total: 5 * 1024 * 1024 * 1024, // Default 5GB
        });
      }
    }

    getStorageInfo();
  }, [storageRefreshTrigger]);

  // Handle unlimited storage display
  const isUnlimited = storage.total === -1;
  const usedPercent = isUnlimited
    ? 0
    : storage.total > 0
      ? ((storage.used / storage.total) * 100).toFixed(1)
      : 0;

  // const handleLogout = () => {
  //   api.logout();
  //   navigate("/login");
  // };

  return (
    <aside className={styles.sidebar}>
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close menu"
      >
        <X size={24} />
      </button>

      <Link to="/profile" className={styles.userSectionLink} onClick={onClose}>
        {user ? (
          <div className={styles.userSection}>
            <div
              className={styles.userAvatar}
              style={{ backgroundColor: getAvatarColor(user.name) }}
            >
              {getUserInitials(user.name)}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>
        ) : (
          <div className={styles.userSection}>
            <div className={styles.userAvatar}>?</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>Loading...</div>
              <div className={styles.userEmail}>Loading...</div>
            </div>
          </div>
        )}
      </Link>

      <div className={`${styles.section} ${styles.mainSection}`}>
        <h2 className={styles.sectionTitle}>My Drive</h2>
        <ul className={styles.menu}>
          {mainMenu.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`${styles.link} ${isActive ? styles.active : ""}`}
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Admin Section - Only visible to admin users */}
      {user && user.role === "admin" && (
        <div className={`${styles.section} ${styles.adminSection}`}>
          <h2 className={styles.sectionTitle}>Admin</h2>
          <ul className={styles.menu}>
            <li>
              <Link
                to="/admin"
                className={`${styles.link} ${
                  location.pathname.startsWith("/admin") ? styles.active : ""
                }`}
                onClick={onClose}
              >
                <Shield size={18} />
                <span>Dashboard</span>
              </Link>
            </li>
          </ul>
        </div>
      )}

      <div className={`${styles.section} ${styles.storageSection}`}>
        <h4 className={styles.sectionTitle}>Storage</h4>
        <div className={styles.storageInfo}>
          <HardDrive size={18} />
          <span>
            {isUnlimited ? (
              <>{formatFileSize(storage.used)} used (Unlimited)</>
            ) : (
              <>
                {formatFileSize(storage.used)} of{" "}
                {formatFileSize(storage.total)} used
              </>
            )}
          </span>
        </div>
        {!isUnlimited && (
          <div className={styles.storageBar}>
            <div
              className={styles.storageUsed}
              style={{ width: `${usedPercent}%` }}
            ></div>
          </div>
        )}
      </div>

      {/* Move logout to profile/settings section */}
    </aside>
  );
};

export default Sidebar;
