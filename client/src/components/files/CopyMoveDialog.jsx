import React, { useState, useEffect } from "react";
import styles from "./CopyMoveDialog.module.css";
import { X, Folder, ChevronRight, Home } from "lucide-react";
import api from "../../services/api";

const CopyMoveDialog = ({
  isOpen,
  onClose,
  onCopyMove,
  item,
  itemType,
  operation, // "copy" or "move"
}) => {
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState("root");
  const [path, setPath] = useState([{ id: "root", name: "My Drive" }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCurrentFolder("root");
      setPath([{ id: "root", name: "My Drive" }]);
      setName(operation === "copy" ? `Copy of ${item?.name || ""}` : "");
      loadFolders("root");
    }
  }, [isOpen, operation, item]);

  const loadFolders = async (folderId) => {
    setLoading(true);
    try {
      const response = await api.getFolderContents(folderId, false, 1, 100);
      // Only show folders that the user owns (can move/copy into)
      const ownedFolders = response.data.folders.filter(
        (folder) =>
          folder.owner._id || folder.owner === localStorage.getItem("user")
      );
      setFolders(ownedFolders);
    } catch (error) {
      console.error("Failed to load folders:", error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = async (folder) => {
    // Prevent navigating into the item being moved
    if (operation === "move" && folder._id === item._id) {
      return;
    }

    setCurrentFolder(folder._id);
    setPath([...path, { id: folder._id, name: folder.name }]);
    await loadFolders(folder._id);
  };

  const navigateToPath = async (index) => {
    const newPath = path.slice(0, index + 1);
    const folderId = newPath[newPath.length - 1].id;
    setPath(newPath);
    setCurrentFolder(folderId);
    await loadFolders(folderId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (operation === "move" && currentFolder === item.parent) {
      // Can't move to the same location
      onClose();
      return;
    }

    if (operation === "move" && currentFolder === item._id) {
      // Can't move into itself
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedName = name.trim();
      await onCopyMove(
        item._id,
        currentFolder,
        itemType,
        operation,
        operation === "copy" && trimmedName ? trimmedName : null
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isCurrentLocation =
    operation === "move" && currentFolder === (item?.parent || "root");
  const isSelfFolder =
    operation === "move" &&
    itemType === "folders" &&
    currentFolder === item._id;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>
            {operation === "copy" ? "Copy" : "Move"}{" "}
            {itemType === "folders" ? "Folder" : "File"}
          </h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {operation === "copy" && (
            <div className={styles.inputGroup}>
              <label htmlFor="itemName">Name (optional)</label>
              <input
                id="itemName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.nameInput}
                placeholder={`Copy of ${item?.name || ""}`}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className={styles.locationSection}>
            <label>Destination</label>

            {/* Breadcrumb navigation */}
            <div className={styles.breadcrumb}>
              {path.map((pathItem, index) => (
                <React.Fragment key={pathItem.id}>
                  {index > 0 && (
                    <ChevronRight
                      size={16}
                      className={styles.breadcrumbSeparator}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => navigateToPath(index)}
                    className={`${styles.breadcrumbItem} ${
                      index === path.length - 1 ? styles.current : ""
                    }`}
                    disabled={isSubmitting}
                  >
                    {index === 0 ? <Home size={16} /> : null}
                    <span>{pathItem.name}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Folder list */}
            <div className={styles.folderList}>
              {loading ? (
                <div className={styles.loading}>Loading folders...</div>
              ) : folders.length === 0 ? (
                <div className={styles.emptyState}>No folders available</div>
              ) : (
                folders.map((folder) => {
                  const isDisabled =
                    (operation === "move" && folder._id === item._id) ||
                    (operation === "move" &&
                      itemType === "folders" &&
                      folder._id === item._id);

                  return (
                    <button
                      key={folder._id}
                      type="button"
                      onClick={() => !isDisabled && navigateToFolder(folder)}
                      className={`${styles.folderItem} ${
                        isDisabled ? styles.disabled : ""
                      }`}
                      disabled={isSubmitting || isDisabled}
                    >
                      <Folder size={16} />
                      <span>{folder.name}</span>
                    </button>
                  );
                })
              )}
            </div>
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
              className={styles.actionButton}
              disabled={isSubmitting || isCurrentLocation || isSelfFolder}
            >
              {isSubmitting
                ? `${operation === "copy" ? "Copying" : "Moving"}...`
                : operation === "copy"
                ? "Copy Here"
                : "Move Here"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CopyMoveDialog;
