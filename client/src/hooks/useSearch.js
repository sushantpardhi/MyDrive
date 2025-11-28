import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useDriveContext } from "../contexts/DriveContext";

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
  const searchTimeoutRef = useRef(null);

  // Debounced search with auto-search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, reload folder contents
    if (!searchQuery.trim()) {
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
        const response = await api.search(searchQuery, 1, 50);
        setSearchResults({
          folders: response.data.folders || [],
          files: response.data.files || [],
        });
        setHasMore(response.data.pagination?.hasMore || false);
        setCurrentPage(1);
        setIsSearching(false);
      } catch (error) {
        toast.error("Search failed");
        console.error(error);
        setIsSearching(false);
      }
    }, 500);

    // Cleanup timeout on unmount or query change
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, currentFolderId, loadFolderContents, api]);

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setCurrentPage(1);
    setHasMore(true);
    setSearchResults({ folders: [], files: [] });
  };

  const loadMoreSearchResults = async () => {
    if (!hasMore || isSearching) return;

    try {
      const nextPage = currentPage + 1;
      const response = await api.search(searchQuery, nextPage, 50);

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

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    clearSearch,
    loadMoreSearchResults,
    hasMore,
    currentPage,
  };
};
