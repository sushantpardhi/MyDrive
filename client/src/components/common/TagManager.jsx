import { useState, useEffect, useRef } from "react";
import { X, Plus, Tag, Check, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./TagManager.module.css";
import api from "../../services/api";
import { toast } from "react-toastify";

const TagManager = ({ item, itemType, onTagsUpdate }) => {
  const [tags, setTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef(null);
  const inputContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (item && item.tags) {
      setTags(item.tags);
    } else {
      setTags([]);
    }
  }, [item]);

  useEffect(() => {
    fetchUserTags();
  }, []);

  useEffect(() => {
    // Click outside to close dropdown
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputContainerRef.current &&
        !inputContainerRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchUserTags = async () => {
    try {
      setLoadingTags(true);
      const response = await api.getTags();
      setAvailableTags(response.data || []);
    } catch (error) {
      console.error("Failed to fetch user tags", error);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleTagSelect = async (tag) => {
    if (tags.includes(tag.name)) {
      toast.warning("Tag already added");
      setInputValue("");
      setShowDropdown(false);
      return;
    }

    await addTag(tag.name);
    // Don't close dropdown immediately to allow multiple selections if desired?
    // User requested "best way", usually closing is better for single add.
    // Let's keep it open for multiple adds if they are clicking.
    setInputValue("");
    // Re-focus input
    inputRef.current?.focus();
  };

  const addTag = async (tagName) => {
    const newTags = [...tags, tagName];
    await updateTags(newTags);
    setInputValue("");
  };

  const removeTag = async (tagToRemove) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    await updateTags(newTags);
  };

  const updateTags = async (newTags) => {
    setIsSubmitting(true);
    try {
      if (itemType === "file") {
        await api.updateFileTags(item._id, newTags);
      } else {
        await api.updateFolderTags(item._id, newTags);
      }
      setTags(newTags);
      if (onTagsUpdate) {
        onTagsUpdate(newTags);
      }
    } catch (error) {
      toast.error("Failed to update tags");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter available tags based on input
  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(tag.name),
  );

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <div
          className={`${styles.tagsInputContainer} ${showDropdown ? styles.active : ""}`}
          ref={inputContainerRef}
          onClick={() => inputRef.current?.focus()}
        >
          <div className={styles.tagsList}>
            {tags.map((tag, index) => (
              <div key={index} className={styles.tag}>
                <span className={styles.tagText}>{tag}</span>
                <button
                  className={styles.removeButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  disabled={isSubmitting}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className={styles.inputRow}>
            <Tag size={16} className={styles.inputIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              placeholder={
                tags.length === 0 ? "Search to add tags..." : "Add more..."
              }
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              disabled={isSubmitting}
            />
            <button
              className={styles.dropdownToggle}
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
            >
              {showDropdown ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>
        </div>

        {showDropdown && (
          <div className={styles.dropdownInline} ref={dropdownRef}>
            {loadingTags ? (
              <div className={styles.dropdownMessage}>Loading tags...</div>
            ) : filteredTags.length > 0 ? (
              <div className={styles.suggestionsList}>
                {filteredTags.map((tag) => (
                  <button
                    key={tag._id}
                    className={styles.suggestionItem}
                    onClick={() => handleTagSelect(tag)}
                  >
                    <div className={styles.suggestionContent}>
                      <span className={styles.suggestionName}>{tag.name}</span>
                    </div>
                    <Plus size={14} className={styles.suggestionIcon} />
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.dropdownMessage}>
                {inputValue
                  ? "No matching tags found"
                  : availableTags.length === 0
                    ? "No tags created yet. Go to Profile to create tags."
                    : " All tags selected"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagManager;
