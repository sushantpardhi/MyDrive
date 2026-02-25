import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";
import logger from "../utils/logger";

const TagContext = createContext(null);

export const useTagContext = () => {
  const ctx = useContext(TagContext);
  if (!ctx) {
    throw new Error("useTagContext must be used within a TagProvider");
  }
  return ctx;
};

export const TagProvider = ({ children }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getTags();
      setTags(response.data || []);
    } catch (error) {
      logger.error("Failed to fetch tags", { error: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = useCallback((newTag) => {
    setTags((prev) => [...prev, newTag]);
  }, []);

  const removeTag = useCallback((tagId) => {
    setTags((prev) => prev.filter((t) => t._id !== tagId));
  }, []);

  return (
    <TagContext.Provider
      value={{ tags, loading, fetchTags, addTag, removeTag }}
    >
      {children}
    </TagContext.Provider>
  );
};
