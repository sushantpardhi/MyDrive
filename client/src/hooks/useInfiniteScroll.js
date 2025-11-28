import { useEffect } from "react";

export const useInfiniteScroll = ({
  containerRef,
  loading,
  loadingMore,
  hasMore,
  searchHasMore,
  currentPage,
  currentFolderId,
  searchQuery,
  loadFolderContents,
  loadMoreSearchResults,
  threshold = 200,
}) => {
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || loading || loadingMore) return;

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

      // Check if scrolled near bottom
      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        if (searchQuery.trim()) {
          // Handle search pagination
          if (searchHasMore) {
            loadMoreSearchResults();
          }
        } else {
          // Handle folder pagination
          if (hasMore) {
            const nextPage = currentPage + 1;
            loadFolderContents(currentFolderId, nextPage, true);
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [
    containerRef,
    loading,
    loadingMore,
    hasMore,
    searchHasMore,
    currentPage,
    currentFolderId,
    searchQuery,
    loadFolderContents,
    loadMoreSearchResults,
    threshold,
  ]);
};
