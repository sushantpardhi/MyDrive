import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  File,
  Folder,
  Search,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import styles from "./TagApplyModal.module.css";

const TagApplyModal = ({ isOpen, tagName, onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [applying, setApplying] = useState(false);
  const searchRef = useRef(null);

  const [folderPath, setFolderPath] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setFolderPath([]);
      setSelectedItems([]);
      setSearchQuery("");
      fetchItems("root");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && folderPath.length >= 0) {
      const currentFolderId =
        folderPath.length > 0 ? folderPath[folderPath.length - 1]._id : "root";
      fetchItems(currentFolderId);
    }
  }, [folderPath]);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      // Small delay so the modal animates in first
      const t = setTimeout(() => searchRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const fetchItems = async (folderId = "root") => {
    try {
      setLoading(true);
      const response = await api.getFolderContents(folderId, false, 1, 200);
      const data = response.data;

      // Combine files and folders into a single list
      const allItems = [];
      if (data.folders) {
        data.folders.forEach((f) =>
          allItems.push({ ...f, itemType: "folder" }),
        );
      }
      if (data.files) {
        data.files.forEach((f) => allItems.push({ ...f, itemType: "file" }));
      }

      setItems(allItems);
    } catch (error) {
      console.error("Failed to fetch items", error);
      toast.error("Failed to load files and folders");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (item) => {
    setSelectedItems((prev) => {
      const exists = prev.find(
        (s) => s._id === item._id && s.itemType === item.itemType,
      );
      if (exists) {
        return prev.filter(
          (s) => !(s._id === item._id && s.itemType === item.itemType),
        );
      }
      return [...prev, item];
    });
  };

  const handleApply = async () => {
    if (selectedItems.length === 0) {
      toast.warning("No items selected");
      return;
    }

    setApplying(true);
    try {
      const promises = selectedItems.map((item) => {
        const currentTags = item.tags || [];
        if (currentTags.includes(tagName)) {
          return Promise.resolve(); // Already tagged
        }
        const newTags = [...currentTags, tagName];
        if (item.itemType === "file") {
          return api.updateFileTags(item._id, newTags);
        } else {
          return api.updateFolderTags(item._id, newTags);
        }
      });

      await Promise.all(promises);
      toast.success(
        `Tag "${tagName}" applied to ${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""}`,
      );
      onClose();
    } catch (error) {
      console.error("Failed to apply tags", error);
      toast.error("Failed to apply tag to some items");
    } finally {
      setApplying(false);
    }
  };

  const handleGoBack = () => {
    setFolderPath((prev) => prev.slice(0, -1));
  };

  const filteredItems = items.filter((item) => {
    const name = item.name || item.originalName || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleContainer}>
            {folderPath.length > 0 && (
              <button
                className={styles.backBtn}
                onClick={handleGoBack}
                aria-label="Go back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className={styles.title}>
                {folderPath.length > 0
                  ? folderPath[folderPath.length - 1].name
                  : `Apply Tag "${tagName}"`}
              </h3>
              <p className={styles.subtitle}>
                {folderPath.length > 0
                  ? "Select items to tag"
                  : `Select files and folders to tag with "${tagName}"`}
              </p>
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.itemsList}>
          {loading ? (
            <div className={styles.emptyState}>
              Loading files and folders...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery
                ? "No matching items found"
                : "No files or folders found"}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedItems.some(
                (s) => s._id === item._id && s.itemType === item.itemType,
              );
              const alreadyTagged = (item.tags || []).includes(tagName);
              const displayName = item.name || item.originalName || "Untitled";

              return (
                <button
                  key={`${item.itemType}-${item._id}`}
                  className={`${styles.itemRow} ${isSelected ? styles.selected : ""} ${alreadyTagged ? styles.alreadyTagged : ""}`}
                  onClick={() => !alreadyTagged && toggleItem(item)}
                  disabled={alreadyTagged}
                  title={
                    alreadyTagged ? "Already tagged" : `Select ${displayName}`
                  }
                >
                  <div
                    className={`${styles.checkbox} ${isSelected ? styles.checked : ""}`}
                  >
                    {isSelected && <Check size={12} />}
                  </div>
                  {item.itemType === "folder" ? (
                    <Folder size={18} className={styles.itemIconFolder} />
                  ) : (
                    <File size={18} className={styles.itemIconFile} />
                  )}
                  <span className={styles.itemName}>{displayName}</span>
                  {alreadyTagged && (
                    <span className={styles.alreadyBadge}>Already tagged</span>
                  )}
                  {item.itemType === "folder" && (
                    <button
                      className={styles.openFolderBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderPath((prev) => [
                          ...prev,
                          { _id: item._id, name: displayName },
                        ]);
                      }}
                      title={`Open ${displayName}`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.selectedCount}>
            {selectedItems.length} selected
          </span>
          <div className={styles.footerActions}>
            <button
              className={`${styles.footerBtn} ${styles.skipBtn}`}
              onClick={onClose}
            >
              Skip for Now
            </button>
            <button
              className={`${styles.footerBtn} ${styles.applyBtn}`}
              onClick={handleApply}
              disabled={applying || selectedItems.length === 0}
            >
              {applying ? "Applying..." : "Apply Tag"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TagApplyModal;
