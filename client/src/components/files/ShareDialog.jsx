import { useState, useEffect, useRef } from "react";
import { X, Search, UserPlus, Mail } from "lucide-react";
import styles from "./ShareDialog.module.css";
import api from "../../services/api";
import { toast } from "react-toastify";

const ShareDialog = ({ item, itemType, onClose, isOpen }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Remove sharing handler
  const handleRemoveShare = async (userId) => {
    try {
      setIsSubmitting(true);
      const response = await api.unshareItem(itemType, item._id, userId);
      toast.success("Sharing removed");
      if (response.data?.item?.shared) {
        setSharedWith(response.data.item.shared);
      } else {
        setSharedWith((prev) => prev.filter((u) => (u._id || u) !== userId));
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || "Failed to remove sharing";
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Fetch full item details with populated shared users
    const fetchItemDetails = async () => {
      try {
        setLoading(true);
        let response;
        if (itemType === "files") {
          response = await api.getFileDetails(item._id);
        } else {
          response = await api.getFolderDetails(item._id);
        }
        setSharedWith(response.data.shared || []);
      } catch (error) {
        console.error("Failed to fetch item details:", error);
        toast.error("Failed to load sharing information");
        // Fallback to what we have
        if (item?.shared) {
          setSharedWith(item.shared);
        }
      } finally {
        setLoading(false);
      }
    };

    if (item?._id) {
      fetchItemDetails();
    }
  }, [item, itemType]);

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, clear results
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.searchUsers(searchQuery);
        setSearchResults(response.data || []);
      } catch (error) {
        console.error("User search failed:", error);
        toast.error("Failed to search users");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleShare = async (userEmail) => {
    try {
      setIsSubmitting(true);
      const response = await api.shareItem(itemType, item._id, userEmail);
      toast.success(`Shared with ${userEmail}`);
      // Update shared users list
      if (response.data?.item?.shared) {
        setSharedWith(response.data.item.shared);
      }
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || error.message || "Failed to share item";
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyShared = (userId) => {
    return sharedWith.some((user) => user._id === userId || user === userId);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Share {itemType === "folders" ? "Folder" : "File"}</h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.itemInfo}>
            <label>Sharing "{item?.name}"</label>
          </div>

          {/* Search Users */}
          <div className={styles.inputGroup}>
            <label htmlFor="userSearch">Add People</label>
            <div className={styles.searchBar}>
              <Search size={18} />
              <input
                id="userSearch"
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* Search Results */}
            {searching && (
              <div className={styles.searchResults}>
                <div className={styles.loading}>Searching...</div>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((user) => (
                  <div key={user._id} className={styles.userItem}>
                    <div className={styles.userAvatar}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{user.name}</div>
                      <div className={styles.userEmail}>{user.email}</div>
                    </div>
                    <button
                      className={styles.shareButton}
                      onClick={() => handleShare(user.email)}
                      disabled={isAlreadyShared(user._id) || isSubmitting}
                    >
                      {isAlreadyShared(user._id) ? (
                        "Shared"
                      ) : (
                        <>
                          <UserPlus size={16} />
                          Share
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!searching &&
              searchQuery.trim().length >= 2 &&
              searchResults.length === 0 && (
                <div className={styles.noResults}>
                  <Mail size={32} />
                  <p>No users found</p>
                </div>
              )}
          </div>

          {/* Currently Shared With */}
          {loading ? (
            <div className={styles.inputGroup}>
              <label>Shared with</label>
              <div className={styles.loading}>Loading shared users...</div>
            </div>
          ) : sharedWith.length > 0 ? (
            <div className={styles.inputGroup}>
              <label>Shared with</label>
              <div className={styles.sharedList}>
                {sharedWith.map((user) => (
                  <div key={user._id || user} className={styles.sharedItem}>
                    <div className={styles.userAvatar}>
                      {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>
                        {user.name || "User"}
                      </div>
                      <div className={styles.userEmail}>{user.email || ""}</div>
                    </div>
                    <button
                      className={styles.removeShareButton}
                      onClick={() => handleRemoveShare(user._id || user)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className={styles.doneButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
