import { createContext, useContext, useState, useEffect } from "react";
import logger from "../utils/logger";

const SearchContext = createContext();

const SEARCH_FILTERS_KEY = "myDriveSearchFilters";
const SEARCH_HISTORY_KEY = "myDriveSearchHistory";

export const useSearchContext = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchContext must be used within a SearchProvider");
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(SEARCH_FILTERS_KEY);
      const defaultFilters = {
        fileTypes: [],
        sizeMin: "",
        sizeMax: "",
        dateStart: "",
        dateEnd: "",
        sortBy: "createdAt",
        sortOrder: "desc",
        tags: [],
      };

      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new fields (like tags) exist
        return { ...defaultFilters, ...parsed, tags: parsed.tags || [] };
      }

      return defaultFilters;
    } catch {
      return {
        fileTypes: [],
        sizeMin: "",
        sizeMax: "",
        dateStart: "",
        dateEnd: "",
        sortBy: "createdAt",
        sortOrder: "desc",
        tags: [],
      };
    }
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(searchFilters));
    } catch (error) {
      logger.error("Failed to save search filters to localStorage", error);
    }
  }, [searchFilters]);

  const updateFilters = (newFilters) => {
    setSearchFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    const defaultFilters = {
      fileTypes: [],
      sizeMin: "",
      sizeMax: "",
      dateStart: "",
      dateEnd: "",
      sortBy: "createdAt",
      sortOrder: "desc",
      tags: [],
    };
    setSearchFilters(defaultFilters);
  };

  const value = {
    searchQuery,
    setSearchQuery,
    searchFilters,
    updateFilters,
    clearFilters,
    setSearchFilters,
  };

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
};
