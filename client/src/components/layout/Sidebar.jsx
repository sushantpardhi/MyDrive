import { Link, useLocation } from "react-router-dom";
import { Home, Share2, Trash2, HardDrive, X } from "lucide-react";
import styles from "./Sidebar.module.css";
import { useState, useEffect } from "react";

const Sidebar = ({ onClose }) => {
  const location = useLocation();

  const mainMenu = [
    { name: "My Drive", icon: <Home size={18} />, path: "/drive" },
    { name: "Shared with me", icon: <Share2 size={18} />, path: "/shared" },
    { name: "Trash", icon: <Trash2 size={18} />, path: "/trash" },
  ];

  const [storage, setStorage] = useState({ used: 0, total: 0 });
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get user info from localStorage
    const userInfo = localStorage.getItem("user");
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }

    //To be handled by Backend in future
    async function getStorageInfo() {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();

        const usedGB = (usage / 1024 ** 3).toFixed(2);
        const totalGB = (quota / 1024 ** 3).toFixed(2);

        setStorage({ used: usedGB, total: totalGB });
      } else {
        setStorage({ used: 10, total: 15 });
      }
    }
    getStorageInfo();
  }, []);

  const usedPercent =
    storage.total > 0 ? ((storage.used / storage.total) * 100).toFixed(1) : 0;

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

      <Link to="/profile" className={styles.userSectionLink}>
        {user ? (
          <div className={styles.userSection}>
            <div className={styles.userAvatar}>
              {user.name.charAt(0).toUpperCase()}
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
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={`${styles.section} ${styles.storageSection}`}>
        <h4 className={styles.sectionTitle}>Storage</h4>
        <div className={styles.storageInfo}>
          <HardDrive size={18} />
          <span>
            {storage.used || 0} GB of {storage.total || 0} GB used
          </span>
        </div>
        <div className={styles.storageBar}>
          <div
            className={styles.storageUsed}
            style={{ width: `${usedPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Move logout to profile/settings section */}
    </aside>
  );
};

export default Sidebar;
