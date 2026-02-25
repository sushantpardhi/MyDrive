import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useDriveContext } from "../contexts/DriveContext";
import { useSearchContext } from "../contexts/SearchContext";
import logger from "../utils/logger";

const SEARCH_HISTORY_KEY = "myDriveSearchHistory";
const MAX_HISTORY_ITEMS = 10;

export const useSearch = (
  api,
  loadFolderContents,
  itemsPerPage = 50,
  section = "drive",
) => {
  const { currentFolderId } = useDriveContext();
  const {
    searchQuery,
    setSearchQuery,
    searchFilters,
    updateFilters,
    clearFilters,
    setSearchFilters,
  } = useSearchContext();

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({
    folders: [],
    files: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const searchTimeoutRef = useRef(null);
  const previousFolderIdRef = useRef(currentFolderId);

  // Save search to history
  const saveToHistory = (query) => {
    if (!query || query.trim().length < 2) return;

    const newHistory = [
      query.trim(),
      ...searchHistory.filter((item) => item !== query.trim()),
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(newHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const folderChanged = previousFolderIdRef.current !== currentFolderId;
    if (folderChanged) {
      previousFolderIdRef.current = currentFolderId;
      setIsSearching(false);
      setCurrentPage(1);
      setSearchResults({ folders: [], files: [] });
      return;
    }

    const hasFilters =
      searchFilters.fileTypes.length > 0 ||
      (searchFilters.tags && searchFilters.tags.length > 0) ||
      searchFilters.sizeMin !== "" ||
      searchFilters.sizeMax !== "" ||
      searchFilters.dateStart !== "" ||
      searchFilters.dateEnd !== "";

    if (!searchQuery.trim() && !hasFilters) {
      setIsSearching(false);
      setCurrentPage(1);
      setSearchResults({ folders: [], files: [] });
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        logger.info("Starting search", { searchQuery, searchFilters });
        const response = await api.search(
          searchQuery,
          1,
          itemsPerPage,
          searchFilters,
          section,
        );
        logger.debug("Search response received", {
          folderCount: response.data.folders?.length,
          fileCount: response.data.files?.length,
        });
        setSearchResults({
          folders: response.data.folders || [],
          files: response.data.files || [],
        });
        setHasMore(response.data.pagination?.hasMore || false);
        setCurrentPage(1);
        setIsSearching(false);

        if (searchQuery.trim()) {
          saveToHistory(searchQuery);
        }
      } catch (error) {
        console.error("Search error details:", error);
        const errorMessage =
          error.response?.data?.error || error.message || "Search failed";
        toast.error(`Search failed: ${errorMessage}`);
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchFilters, currentFolderId, api, itemsPerPage, section]);

  const clearSearchForNavigation = () => {
    setSearchQuery("");
    setIsSearching(false);
    setCurrentPage(1);
    setHasMore(true);
    setSearchResults({ folders: [], files: [] });
    // Also clear tag filter when navigating into a folder
    if (searchFilters.tags && searchFilters.tags.length > 0) {
      updateFilters({ tags: [] });
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setCurrentPage(1);
    setHasMore(true);
    setSearchResults({ folders: [], files: [] });
    loadFolderContents(currentFolderId, 1, false);
  };

  const loadMoreSearchResults = async () => {
    if (!hasMore || isSearching) return;

    try {
      const nextPage = currentPage + 1;
      const response = await api.search(
        searchQuery,
        nextPage,
        itemsPerPage,
        searchFilters,
        section,
      );

      setSearchResults((prev) => ({
        folders: [
          ...prev.folders,
          ...(response.data.folders || []).filter(
            (f) => !prev.folders.some((existing) => existing._id === f._id),
          ),
        ],
        files: [
          ...prev.files,
          ...(response.data.files || []).filter(
            (f) => !prev.files.some((existing) => existing._id === f._id),
          ),
        ],
      }));

      setHasMore(response.data.pagination?.hasMore ?? false);
      setCurrentPage(response.data.pagination?.page ?? nextPage);
    } catch (error) {
      toast.error("Failed to load more results");
      console.error(error);
    }
  };

  const hasActiveFilters = () => {
    return (
      searchFilters.fileTypes.length > 0 ||
      (searchFilters.tags && searchFilters.tags.length > 0) ||
      searchFilters.sizeMin !== "" ||
      searchFilters.sizeMax !== "" ||
      searchFilters.dateStart !== "" ||
      searchFilters.dateEnd !== ""
    );
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    clearSearch,
    clearSearchForNavigation,
    loadMoreSearchResults,
    hasMore,
    searchFilters,
    updateFilters,
    clearFilters,
    hasActiveFilters: hasActiveFilters(),
    searchHistory,
    clearHistory,
  };
};
