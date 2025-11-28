import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Header.module.css";
import { Bell, Settings, User, Plus, X } from "lucide-react";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.brand}></div>

      <div className={styles.actions} ref={menuRef}>
        {/* Desktop view - show all buttons */}
        <button className={`${styles.iconButton} ${styles.desktopOnly}`}>
          <Bell size={20} />
        </button>
        <Link
          to="/profile"
          className={`${styles.iconButton} ${styles.desktopOnly}`}
        >
          <Settings size={20} />
        </Link>
        <Link
          to="/profile"
          className={`${styles.userButton} ${styles.desktopOnly}`}
        >
          <User size={20} />
        </Link>

        {/* Mobile view - show + menu */}
        <div className={styles.mobileMenu}>
          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={20} /> : <Plus size={20} />}
          </button>

          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  // Add notification handler
                }}
              >
                <Bell size={18} />
                <span>Notifications</span>
              </button>
              <Link
                to="/profile"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                <Settings size={18} />
                <span>Settings</span>
              </Link>
              <Link
                to="/profile"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                }}
              >
                <User size={18} />
                <span>Profile</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
