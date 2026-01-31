import { useState, useEffect, useRef } from "react";
import { X, FolderPlus } from "lucide-react";
import styles from "./CreateFolderModal.module.css";

const CreateFolderModal = ({ isOpen, onClose, onCreateFolder }) => {
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      // Focus input after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = folderName.trim();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreateFolder(trimmedName);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onKeyDown={handleKeyDown}>
        <div className={styles.header}>
          <div className={styles.title}>
            <FolderPlus size={20} />
            <span>New Folder</span>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.content}>
          <div className={styles.inputGroup}>
            <label htmlFor="folderName" className={styles.label}>
              Folder name
            </label>
            <input
              ref={inputRef}
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              className={styles.input}
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.createButton}
              disabled={!folderName.trim() || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFolderModal;
