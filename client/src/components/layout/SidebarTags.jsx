import { useState, useRef, useEffect } from "react";
import { Tag, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";
import { useSearchContext } from "../../contexts/SearchContext";
import styles from "./SidebarTags.module.css";
import logger from "../../utils/logger";
import { createPortal } from "react-dom";

const CreateTagModal = ({ isOpen, mechanism, onClose, onCreate }) => {
  const [tagName, setTagName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tagName.trim()) {
      onCreate(tagName.trim());
      setTagName("");
    }
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Create New Tag</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Enter tag name"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            autoFocus
          />
          <div className={styles.modalActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.createButton}`}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

const SidebarTags = ({ onClose }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { searchFilters, updateFilters } = useSearchContext();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await api.getTags();
      setTags(response.data || []);
    } catch (error) {
      console.error("Failed to fetch tags", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (tagName) => {
    try {
      // Check for duplicate locally
      if (tags.some((t) => t.name.toLowerCase() === tagName.toLowerCase())) {
        toast.warning("Tag already exists");
        return;
      }

      const response = await api.createTag(tagName);
      setTags([...tags, response.data]);
      setIsModalOpen(false);
      toast.success("Tag created");
    } catch (error) {
      logger.error("Failed to create tag", error);
      toast.error("Failed to create tag");
    }
  };

  const handleTagClick = (tag) => {
    const isAlreadyActive =
      searchFilters.tags && searchFilters.tags.includes(tag.name);

    if (isAlreadyActive) {
      updateFilters({ tags: [] });
    } else {
      updateFilters({ tags: [tag.name] });

      // Navigate to drive if not there
      if (!location.pathname.startsWith("/drive")) {
        navigate("/drive");
      }
    }

    console.log("Tag clicked:", tag.name);

    if (onClose) onClose();
  };

  return (
    <>
      <div className={styles.section}>
        <div className={styles.header}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          <button
            className={styles.addButton}
            onClick={() => setIsModalOpen(true)}
            aria-label="Add tag"
            title="Create new tag"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className={styles.tagsContainer}>
          <ul className={styles.menu}>
            {loading ? (
              <li
                className={styles.tagLink}
                style={{ opacity: 0.6, cursor: "default" }}
              >
                <span style={{ fontSize: "0.85rem" }}>Loading...</span>
              </li>
            ) : tags.length === 0 ? (
              <li
                className={styles.tagLink}
                style={{ opacity: 0.6, cursor: "default" }}
              >
                <span style={{ fontSize: "0.85rem" }}>No tags created</span>
              </li>
            ) : (
              tags.map((tag) => {
                const isActive =
                  searchFilters.tags && searchFilters.tags.includes(tag.name);
                return (
                  <li key={tag._id}>
                    <button
                      className={`${styles.tagLink} ${isActive ? styles.active : ""}`}
                      onClick={() => handleTagClick(tag)}
                    >
                      <Tag size={16} />
                      <span>{tag.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <CreateTagModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateTag}
      />
    </>
  );
};

export default SidebarTags;
