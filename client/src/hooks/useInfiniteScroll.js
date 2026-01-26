import { useEffect, useCallback } from "react";

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
  // Function to check if we need to load more content
  const checkAndLoadMore = useCallback(() => {
    if (!containerRef.current || loading || loadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    // Check if content doesn't overflow (no scrollbar) or scrolled near bottom
    const noOverflow = scrollHeight <= clientHeight;
    const nearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

    if (noOverflow || nearBottom) {
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

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", checkAndLoadMore);
      return () => container.removeEventListener("scroll", checkAndLoadMore);
    }
  }, [containerRef, checkAndLoadMore]);

  // Check on mount and when loading state changes - if content doesn't overflow, load more
  useEffect(() => {
    // Small delay to allow DOM to render
    const timeoutId = setTimeout(() => {
      checkAndLoadMore();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [loading, loadingMore, hasMore, searchHasMore, checkAndLoadMore]);
};
