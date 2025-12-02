import React, { useState, useEffect, useRef } from "react";
import styles from "./RenameDialog.module.css";
import { X } from "lucide-react";
import { useUIContext } from "../../contexts";

// Extract file name and extension for files
const getFileNameParts = (fullName, isFolder) => {
  if (isFolder || !fullName) {
    return { nameOnly: fullName || "", extension: "" };
  }

  const lastDotIndex = fullName.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    // No extension or hidden file
    return { nameOnly: fullName, extension: "" };
  }

  return {
    nameOnly: fullName.substring(0, lastDotIndex),
    extension: fullName.substring(lastDotIndex),
  };
};

const RenameDialog = ({ isOpen, onClose, onRename, item, itemType }) => {
  const [name, setName] = useState("");
  const inputRef = useRef(null);
  const { showLoading, hideLoading } = useUIContext();

  const fileNameParts = item
    ? getFileNameParts(item.name, itemType === "folders")
    : { nameOnly: "", extension: "" };
  const { extension } = fileNameParts;

  useEffect(() => {
    if (isOpen && item) {
      // For files, only show the name part without extension
      const { nameOnly } = getFileNameParts(item.name, itemType === "folders");
      setName(itemType === "folders" ? item.name : nameOnly);

      // Focus input and select text after a small delay to ensure dialog is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, item, itemType]);

  const validateName = (inputName) => {
    if (!inputName.trim()) {
      return "Name cannot be empty";
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(inputName)) {
      return 'Name cannot contain: < > : " / \\ | ? *';
    }

    // Check for reserved names on Windows
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(inputName.trim())) {
      return "This name is reserved and cannot be used";
    }

    return null;
  };

  const validationError = validateName(name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || validationError) return;

    // For files, reconstruct the full name with extension
    const finalName =
      itemType === "folders" ? trimmedName : `${trimmedName}${extension}`;

    if (finalName === item.name) {
      onClose();
      return;
    }

    showLoading(`Renaming ${itemType === "folders" ? "folder" : "file"}...`);
    try {
      await onRename(item._id, finalName, itemType);
      onClose();
    } finally {
      hideLoading();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Rename {itemType === "folders" ? "Folder" : "File"}</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="itemName">Name</label>
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                id="itemName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${styles.nameInput} ${
                  extension ? styles.hasExtension : ""
                }`}
                placeholder={`Enter ${
                  itemType === "folders" ? "folder" : "file"
                } name`}
                required
              />
              {extension && (
                <span
                  className={styles.extension}
                  title="File extension (cannot be changed)"
                >
                  {extension}
                </span>
              )}
            </div>
            {extension && (
              <p className={styles.extensionNote}>
                File extension cannot be changed to maintain file integrity
              </p>
            )}
            {validationError && (
              <p className={styles.errorMessage}>{validationError}</p>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.renameButton}
              disabled={!name.trim() || validationError}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameDialog;
