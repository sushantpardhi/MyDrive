import { Plus, FolderPlus, Upload, Trash2 } from "lucide-react";
import { useRef, useEffect } from "react";
import styles from "./FloatingActionButton.module.css";

const FloatingActionButton = ({
  type,
  isOpen,
  setIsOpen,
  onCreateFolder,
  onFileUpload,
  onEmptyTrash,
  fileInputRef,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  const renderMenuItems = () => {
    if (type === "drive") {
      return (
        <>
          <button
            onClick={() => {
              onCreateFolder();
              setIsOpen(false);
            }}
            className={styles.mobileMenuItem}
          >
            <FolderPlus size={18} />
            <span>New Folder</span>
          </button>
          <button
            onClick={() => {
              fileInputRef.current?.click();
              setIsOpen(false);
            }}
            className={styles.mobileMenuItem}
          >
            <Upload size={18} />
            <span>Upload</span>
          </button>
        </>
      );
    }

    if (type === "trash") {
      return (
        <button
          onClick={() => {
            onEmptyTrash();
            setIsOpen(false);
          }}
          className={styles.mobileMenuItemDanger}
        >
          <Trash2 size={18} />
          <span>Empty Trash</span>
        </button>
      );
    }

    return null;
  };

  if (type === "shared") {
    return null;
  }

  return (
    <>
      {isOpen && (
        <div className={styles.fabBackdrop} onClick={() => setIsOpen(false)} />
      )}
      <div className={styles.mobileActionsMenu} ref={menuRef}>
        <button
          className={`${styles.mobileActionsToggle} ${
            isOpen ? styles.open : ""
          }`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Actions"
        >
          <Plus size={24} />
        </button>

        {isOpen && (
          <div className={styles.mobileActionsDropdown}>
            {renderMenuItems()}
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingActionButton;
