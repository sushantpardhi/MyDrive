import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useDriveContext } from "../contexts/DriveContext";

const SEARCH_HISTORY_KEY = "myDriveSearchHistory";
const MAX_HISTORY_ITEMS = 10;

export const useSearch = (api, loadFolderContents) => {
  const { currentFolderId } = useDriveContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({
    folders: [],
    files: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchFilters, setSearchFilters] = useState({
    fileTypes: [],
    sizeMin: "",
    sizeMax: "",
    dateStart: "",
    dateEnd: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const searchTimeoutRef = useRef(null);

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

  // Debounced search with auto-search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Check if we have any active filters
    const hasFilters =
      searchFilters.fileTypes.length > 0 ||
      searchFilters.sizeMin !== "" ||
      searchFilters.sizeMax !== "" ||
      searchFilters.dateStart !== "" ||
      searchFilters.dateEnd !== "";

    // If no search query and no filters, reload folder contents
    if (!searchQuery.trim() && !hasFilters) {
      loadFolderContents(currentFolderId, 1, false);
      setIsSearching(false);
      setCurrentPage(1);
      setSearchResults({ folders: [], files: [] });
      return;
    }

    // Set searching state immediately for UI feedback
    setIsSearching(true);

    // Debounce search by 500ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(
          "Starting search with query:",
          searchQuery,
          "filters:",
          searchFilters
        );
        const response = await api.search(searchQuery, 1, 50, searchFilters);
        console.log("Search response:", response.data);
        setSearchResults({
          folders: response.data.folders || [],
          files: response.data.files || [],
        });
        setHasMore(response.data.pagination?.hasMore || false);
        setCurrentPage(1);
        setIsSearching(false);

        // Save to history on successful search (only if there's a query)
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

    // Cleanup timeout on unmount or query change
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchFilters, currentFolderId, loadFolderContents, api]);

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setCurrentPage(1);
    setHasMore(true);
    setSearchResults({ folders: [], files: [] });
  };

  const updateFilters = (newFilters) => {
    setSearchFilters(newFilters);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchFilters({
      fileTypes: [],
      sizeMin: "",
      sizeMax: "",
      dateStart: "",
      dateEnd: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  const loadMoreSearchResults = async () => {
    if (!hasMore || isSearching) return;

    try {
      const nextPage = currentPage + 1;
      const response = await api.search(
        searchQuery,
        nextPage,
        50,
        searchFilters
      );

      // Filter out duplicates when appending search results
      setSearchResults((prev) => ({
        folders: [
          ...prev.folders,
          ...(response.data.folders || []).filter(
            (f) => !prev.folders.some((existing) => existing._id === f._id)
          ),
        ],
        files: [
          ...prev.files,
          ...(response.data.files || []).filter(
            (f) => !prev.files.some((existing) => existing._id === f._id)
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
