import React, { useState, useEffect } from "react";
import styles from "./CopyMoveDialog.module.css";
import { X, Folder, ChevronRight, Home, FolderPlus } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../common/LoadingSpinner";
import { useUIContext } from "../../contexts";
import logger from "../../utils/logger";

const CopyMoveDialog = ({
  isOpen,
  onClose,
  onCopyMove,
  item,
  items = [], // For bulk operations
  itemType,
  operation, // "copy" or "move"
}) => {
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState("root");
  const [path, setPath] = useState([{ id: "root", name: "My Drive" }]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState("");
  const { showLoading, hideLoading } = useUIContext();

  const isBulkOperation = items.length > 0;
  const itemCount = isBulkOperation ? items.length : 1;

  useEffect(() => {
    if (isOpen) {
      setCurrentFolder("root");
      setPath([{ id: "root", name: "My Drive" }]);
      setName(
        operation === "copy" && !isBulkOperation
          ? `Copy of ${item?.name || ""}`
          : ""
      );
      setIsCreatingFolder(false);
      setNewFolderName("");
      setCreateFolderError("");
      loadFolders("root");
    }
  }, [isOpen, operation, item, isBulkOperation]);

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
      logger.logError(error, "Failed to load folders", { folderId });
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = async (folder) => {
    // Prevent navigating into the item being moved (for single item operations)
    if (operation === "move" && !isBulkOperation && folder._id === item._id) {
      return;
    }

    // For bulk operations, prevent navigating into any of the folders being moved
    if (operation === "move" && isBulkOperation) {
      const isFolderBeingMoved = items.some((it) => it._id === folder._id);
      if (isFolderBeingMoved) {
        return;
      }
    }

    setCurrentFolder(folder._id);
    setPath([...path, { id: folder._id, name: folder.name }]);
    setIsCreatingFolder(false);
    setNewFolderName("");
    setCreateFolderError("");
    await loadFolders(folder._id);
  };

  const navigateToPath = async (index) => {
    const newPath = path.slice(0, index + 1);
    const folderId = newPath[newPath.length - 1].id;
    setPath(newPath);
    setCurrentFolder(folderId);
    setIsCreatingFolder(false);
    setNewFolderName("");
    setCreateFolderError("");
    await loadFolders(folderId);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();

    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setCreateFolderError("Folder name cannot be empty");
      return;
    }

    setLoading(true);
    setCreateFolderError("");

    try {
      await api.createFolder(trimmedName, currentFolder);
      setIsCreatingFolder(false);
      setNewFolderName("");
      // Reload folders to show the newly created one
      await loadFolders(currentFolder);
    } catch (error) {
      logger.logError(error, "Failed to create folder", {
        folderName: trimmedName,
        currentFolder,
      });
      setCreateFolderError(
        error.response?.data?.error || "Failed to create folder"
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
    setCreateFolderError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // For single item operations
    if (!isBulkOperation) {
      if (operation === "move" && currentFolder === item.parent) {
        // Can't move to the same location
        onClose();
        return;
      }

      if (operation === "move" && currentFolder === item._id) {
        // Can't move into itself
        return;
      }
    }

    // For bulk operations with move, check if moving to current parent of any item
    if (isBulkOperation && operation === "move") {
      const allInSameLocation = items.every(
        (it) => (it.parent || "root") === currentFolder
      );
      if (allInSameLocation) {
        onClose();
        return;
      }
    }

    showLoading(
      `${operation === "copy" ? "Copying" : "Moving"} ${
        isBulkOperation ? itemCount + " items" : "item"
      }...`
    );
    try {
      if (isBulkOperation) {
        // Bulk operation
        await onCopyMove(currentFolder, operation);
      } else {
        // Single item operation
        const trimmedName = name.trim();
        await onCopyMove(
          item._id,
          currentFolder,
          itemType,
          operation,
          operation === "copy" && trimmedName ? trimmedName : null
        );
      }
      onClose();
    } finally {
      hideLoading();
    }
  };

  if (!isOpen) return null;

  const isCurrentLocation =
    operation === "move" &&
    !isBulkOperation &&
    currentFolder === (item?.parent || "root");
  const isSelfFolder =
    operation === "move" &&
    !isBulkOperation &&
    itemType === "folders" &&
    currentFolder === item._id;

  // For bulk operations, check if all items are in the current location
  const allItemsInCurrentLocation =
    operation === "move" &&
    isBulkOperation &&
    items.every((it) => (it.parent || "root") === currentFolder);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>
            {operation === "copy" ? "Copy" : "Move"}{" "}
            {isBulkOperation
              ? `${itemCount} Items`
              : itemType === "folders"
              ? "Folder"
              : "File"}
          </h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {operation === "copy" && !isBulkOperation && (
            <div className={styles.inputGroup}>
              <label htmlFor="itemName">Name (optional)</label>
              <input
                id="itemName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.nameInput}
                placeholder={`Copy of ${item?.name || ""}`}
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
                <div className={styles.loading}>
                  <LoadingSpinner size="small" message="Loading folders..." />
                </div>
              ) : folders.length === 0 ? (
                <div className={styles.emptyState}>No folders available</div>
              ) : (
                folders.map((folder) => {
                  let isDisabled = false;

                  // For single item operations
                  if (!isBulkOperation) {
                    isDisabled =
                      (operation === "move" && folder._id === item._id) ||
                      (operation === "move" &&
                        itemType === "folders" &&
                        folder._id === item._id);
                  } else {
                    // For bulk operations, disable if any of the items match this folder
                    isDisabled =
                      operation === "move" &&
                      items.some((it) => it._id === folder._id);
                  }

                  return (
                    <button
                      key={folder._id}
                      type="button"
                      onClick={() => !isDisabled && navigateToFolder(folder)}
                      className={`${styles.folderItem} ${
                        isDisabled ? styles.disabled : ""
                      }`}
                      disabled={isDisabled}
                    >
                      <Folder size={16} />
                      <span>{folder.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Create new folder section */}
          {isCreatingFolder && (
            <div className={styles.createFolderSection}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className={styles.createFolderInput}
                autoFocus
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder(e);
                  } else if (e.key === "Escape") {
                    cancelCreateFolder();
                  }
                }}
              />
              <div className={styles.createFolderActions}>
                <button
                  type="button"
                  onClick={cancelCreateFolder}
                  className={styles.createFolderCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className={styles.createFolderConfirm}
                  disabled={loading || !newFolderName.trim()}
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
              {createFolderError && (
                <div className={styles.createFolderError}>
                  {createFolderError}
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            {!isCreatingFolder && (
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className={styles.newFolderButton}
                disabled={loading}
              >
                <FolderPlus size={18} />
                <span>New Folder</span>
              </button>
            )}
            <div className={styles.actionButtons}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.actionButton}
                disabled={
                  isCurrentLocation || isSelfFolder || allItemsInCurrentLocation
                }
              >
                {operation === "copy"
                  ? `Copy Here${isBulkOperation ? ` (${itemCount})` : ""}`
                  : `Move Here${isBulkOperation ? ` (${itemCount})` : ""}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CopyMoveDialog;
