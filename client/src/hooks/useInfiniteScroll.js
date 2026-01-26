import { useEffect, useCallback, useRef } from "react";

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
  // Track the folder ID to prevent loading stale folder during navigation
  const lastLoadedFolderRef = useRef(currentFolderId);
  
  // Update ref when folder changes
  useEffect(() => {
    lastLoadedFolderRef.current = currentFolderId;
  }, [currentFolderId]);

  // Function to check if we need to load more content
  const checkAndLoadMore = useCallback(() => {
    if (!containerRef.current || loading || loadingMore) return;
    
    // Only load more if we're still on the same folder (prevent loading during navigation)
    if (lastLoadedFolderRef.current !== currentFolderId) return;
    
    // Don't try to load more on page 1 - initial load is handled by DriveView
    if (currentPage < 1) return;

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
        // Handle folder pagination - only load next page, not page 1
        if (hasMore && currentPage >= 1) {
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

  // Check when loading finishes - if content doesn't overflow, load more
  // Only triggers when loading transitions from true to false (load completed)
  const wasLoadingRef = useRef(loading);
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = loading;
    
    // Only check after a load completes (loading goes from true to false)
    // And only if we're not in the middle of loading more
    if (wasLoading && !loading && !loadingMore && currentPage >= 1) {
      // Small delay to allow DOM to render
      const timeoutId = setTimeout(() => {
        checkAndLoadMore();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [loading, loadingMore, currentPage, checkAndLoadMore]);
};
