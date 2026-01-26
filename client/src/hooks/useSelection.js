import { useCallback } from "react";
import { toast } from "react-toastify";
import { downloadFile } from "../utils/helpers";
import { useSelectionContext } from "../contexts/SelectionContext";
import { useUIContext, useTransfer } from "../contexts";
import logger from "../utils/logger";
import { removeCachedImage } from "../utils/imageCache";

export const useSelection = (api, folders, files, type) => {
  const {
    selectedItems,
    selectAll: selectAllContext,
    toggleSelection,
    clearSelection,
  } = useSelectionContext();
  const { refreshStorage } = useUIContext();
  const { 
    startDownload, 
    updateZippingProgress, 
    updateDownloadProgress,
    completeDownload,
    failDownload,
    cancelDownload,
    registerXhr,
    unregisterXhr,
  } = useTransfer();

  const selectAll = useCallback(() => {
    const allItemIds = [
      ...folders.map((f) => f._id),
      ...files.map((f) => f._id),
    ];

    // Check if all currently visible items are selected
    const allSelected = allItemIds.every((id) => selectedItems.has(id));

    if (allSelected && allItemIds.length > 0) {
      // Unselect all - pass empty array
      selectAllContext([]);
    } else {
      // Select all currently visible items
      selectAllContext(allItemIds);
    }
  }, [folders, files, selectedItems, selectAllContext]);

  const bulkDelete = useCallback(
    async (onComplete, passwordVerifyFn = null) => {
      if (!selectedItems.size) return false;

      const confirmMessage =
        type === "trash"
          ? `Are you sure you want to permanently delete ${selectedItems.size} items? This cannot be undone.`
          : `Are you sure you want to move ${selectedItems.size} items to trash?`;

      if (type === "trash") {
        // For permanent deletion from trash, require password verification
        if (!passwordVerifyFn) {
          toast.error(
            "Password verification is required for permanent deletion"
          );
          logger.error(
            "bulkDelete called with type=trash but no passwordVerifyFn provided"
          );
          return false;
        }

        try {
          await passwordVerifyFn(confirmMessage);
        } catch (error) {
          logger.info(
            "Password verification cancelled or failed for bulk delete"
          );
          return false;
        }
      } else {
        // For moving to trash, use normal confirmation
        if (!window.confirm(confirmMessage)) return false;
      }

      try {
        const selectedItemsArray = [...selectedItems];
        logger.info("bulkDelete: Starting bulk delete", {
          itemCount: selectedItemsArray.length,
          itemIds: selectedItemsArray,
          type,
        });

        const promises = selectedItemsArray.map((id) => {
          const isFile = files.find((f) => f._id === id);
          const itemType = isFile ? "files" : "folders";
          logger.debug("bulkDelete: Deleting item", { id, itemType, isFile: !!isFile });
          return type === "trash"
            ? api.deleteItemPermanently(itemType, id)
            : api.moveToTrash(itemType, id);
        });

        logger.info("bulkDelete: Created promises", { promiseCount: promises.length });
        await Promise.all(promises);
        logger.info("bulkDelete: All promises resolved");

        // Clear cached images for permanently deleted files
        if (type === "trash") {
          const fileIds = selectedItemsArray.filter(id => 
            files.find((f) => f._id === id)
          );
          for (const fileId of fileIds) {
            await removeCachedImage(fileId);
          }
          logger.info("Cleared cached images for deleted files", { fileIds });
        }

        if (onComplete) await onComplete();
        clearSelection();

        // Refresh storage display if items were permanently deleted
        if (type === "trash") {
          logger.info("Refreshing storage after bulk permanent deletion", {
            itemCount: selectedItems.size,
          });
          refreshStorage();
        }

        toast.success(
          type === "trash"
            ? "Items permanently deleted"
            : "Items moved to trash"
        );
        return true;
      } catch (error) {
        const errorMsg =
          error.response?.data?.error ||
          (type === "trash"
            ? "Bulk permanent deletion failed"
            : "Moving items to trash failed");
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [selectedItems, files, type, api, clearSelection, refreshStorage]
  );

  const bulkRestore = useCallback(async () => {
    if (!selectedItems.size) return false;

    try {
      const selectedItemsArray = [...selectedItems];
      logger.info("bulkRestore: Starting bulk restore", {
        itemCount: selectedItemsArray.length,
        itemIds: selectedItemsArray,
      });

      const promises = selectedItemsArray.map((id) => {
        const isFile = files.find((f) => f._id === id);
        const itemType = isFile ? "files" : "folders";
        logger.debug("bulkRestore: Restoring item", { id, itemType, isFile: !!isFile });
        return api.restoreFromTrash(itemType, id);
      });

      logger.info("bulkRestore: Created promises", { promiseCount: promises.length });
      await Promise.all(promises);
      logger.info("bulkRestore: All promises resolved");
      clearSelection();
      toast.success("Items restored successfully");
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Bulk restore failed";
      toast.error(errorMsg);
      console.error(error);
      return false;
    }
  }, [selectedItems, files, api, clearSelection]);

  const bulkShare = useCallback(() => {
    if (!selectedItems.size) return [];

    // Return selected items for the parent component to handle with ShareDialog
    const itemsList = [...selectedItems]
      .map((id) => {
        const file = files.find((f) => f._id === id);
        const folder = folders.find((f) => f._id === id);
        return file || folder;
      })
      .filter(Boolean);

    return itemsList;
  }, [selectedItems, files, folders]);

  const bulkDownload = useCallback(async () => {
    if (!selectedItems.size) {
      toast.warning("Please select items to download");
      return false;
    }

    const selectedFilesList = files.filter((f) => selectedItems.has(f._id));
    const selectedFoldersList = folders.filter((f) => selectedItems.has(f._id));
    
    const fileIds = selectedFilesList.map(f => f._id);
    const folderIds = selectedFoldersList.map(f => f._id);

    // Validate that we have valid items
    if (fileIds.length === 0 && folderIds.length === 0) {
      toast.error("No valid items found to download");
      return false;
    }

    // Handle single file download (existing behavior)
    if (fileIds.length === 1 && folderIds.length === 0) {
      const file = selectedFilesList[0];
      try {
        await downloadFile(api, file._id, file.name);
        toast.success("File downloaded successfully");
        return true;
      } catch (error) {
        toast.error("Download failed");
        console.error(error);
        return false;
      }
    }

    // All other cases (single folder, multiple files, multiple folders, mixed) 
    // use the multi-download endpoint

    // Handle multi-item download with ZIP
    const downloadId = `multi-download-${Date.now()}`;
    const totalItems = selectedItems.size;
    
    // Estimate total size (sum of file sizes)
    const estimatedSize = selectedFilesList.reduce((sum, f) => sum + (f.size || 0), 0);

    try {
      // Determine filename
      let downloadName = "download.zip";
      if (folderIds.length === 1 && fileIds.length === 0) {
        downloadName = `${selectedFoldersList[0].name}.zip`;
      } else if (fileIds.length > 0 && folderIds.length === 0) {
        downloadName = `${fileIds.length}-files.zip`;
      } else {
        downloadName = `${totalItems}-items.zip`;
      }

      // Start download progress tracking
      startDownload(downloadId, downloadName, estimatedSize, totalItems);

      logger.info("Starting multi-item download", {
        downloadId,
        fileCount: fileIds.length,
        folderCount: folderIds.length,
        totalItems,
        fileIds,
        folderIds,
      });

      // Show initial zipping progress
      updateZippingProgress(downloadId, 0, totalItems);

      // Make API call with XMLHttpRequest for progress tracking
      const token = localStorage.getItem("token");
      const API_URL = process.env.REACT_APP_API_URL;
      
      console.log("Download request details:", {
        url: `${API_URL}/files/download`,
        fileIds,
        folderIds,
        hasToken: !!token,
      });
      
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/files/download`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "blob";
      xhr.timeout = 30 * 60 * 1000; // 30 minutes

      // Register XHR for cancel functionality
      registerXhr(downloadId, xhr);

      let lastLoaded = 0;
      let lastTime = Date.now();
      let isFirstProgress = true;

      // Track download progress
      xhr.onprogress = (event) => {
        // On first progress event, we know zipping is complete and download has started
        if (isFirstProgress && event.loaded > 0) {
          isFirstProgress = false;
          // Mark zipping as complete
          updateZippingProgress(downloadId, totalItems, totalItems);
        }
        
        if (event.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const bytesDiff = event.loaded - lastLoaded;
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

          lastLoaded = event.loaded;
          lastTime = now;

          updateDownloadProgress(downloadId, event.loaded, event.total, speed);
        }
      };

      xhr.onload = () => {
        // Unregister XHR on completion
        unregisterXhr(downloadId);
        
        if (xhr.status === 200) {
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", downloadName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          completeDownload(downloadId, true);
          toast.success(`Downloaded ${totalItems} item${totalItems > 1 ? 's' : ''} successfully`);

          logger.info("Multi-item download completed", {
            downloadId,
            totalItems,
          });
        } else {
          // Try to parse error message from blob response
          let errorMsg = xhr.statusText || "Download failed";
          
          // If response is JSON error, extract message
          if (xhr.response && xhr.response.type === 'application/json') {
            try {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const error = JSON.parse(reader.result);
                  const errorMessage = error.error || error.message || errorMsg;
                  failDownload(downloadId);
                  toast.error(errorMessage);
                  logger.error("Multi-item download failed", {
                    downloadId,
                    status: xhr.status,
                    error: errorMessage,
                  });
                } catch (e) {
                  failDownload(downloadId);
                  toast.error(errorMsg);
                }
              };
              reader.readAsText(xhr.response);
              return;
            } catch (e) {
              // Fall through to default error handling
            }
          }
          
          failDownload(downloadId);
          toast.error(errorMsg);
          logger.error("Multi-item download failed", {
            downloadId,
            status: xhr.status,
            error: errorMsg,
          });
        }
      };

      xhr.onerror = () => {
        unregisterXhr(downloadId);
        failDownload(downloadId);
        toast.error("Download failed");
        logger.error("Multi-item download error", { downloadId });
      };

      xhr.onabort = () => {
        unregisterXhr(downloadId);
        // Don't call cancelDownload here - it's already handled by the cancel action
        // Just show the toast
        toast.info("Download cancelled");
        logger.info("Multi-item download cancelled", { downloadId });
      };

      xhr.ontimeout = () => {
        unregisterXhr(downloadId);
        failDownload(downloadId);
        toast.error("Download timed out");
        logger.error("Multi-item download timeout", { downloadId });
      };

      // Send request
      xhr.send(JSON.stringify({ files: fileIds, folders: folderIds }));

      return true;
    } catch (error) {
      failDownload(downloadId);
      toast.error("Download failed");
      logger.error("Multi-item download error", {
        downloadId,
        error: error.message,
      });
      console.error(error);
      return false;
    }
  }, [
    selectedItems, 
    files, 
    folders, 
    api,
    startDownload,
    updateZippingProgress,
    updateDownloadProgress,
    completeDownload,
    failDownload,
    cancelDownload,
    registerXhr,
    unregisterXhr,
  ]);

  const bulkCopy = useCallback(
    async (targetParent, onComplete) => {
      if (!selectedItems.size) return false;

      try {
        const promises = [...selectedItems].map((id) => {
          const file = files.find((f) => f._id === id);
          const itemType = file ? "files" : "folders";
          return itemType === "files"
            ? api.copyFile(id, targetParent, null)
            : api.copyFolder(id, targetParent, null);
        });

        await Promise.all(promises);

        if (onComplete) await onComplete();
        clearSelection();

        toast.success(
          `${selectedItems.size} item${
            selectedItems.size > 1 ? "s" : ""
          } copied successfully`
        );
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Bulk copy failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [selectedItems, files, api, clearSelection]
  );

  const bulkMove = useCallback(
    async (targetParent, onComplete) => {
      if (!selectedItems.size) return false;

      try {
        const promises = [...selectedItems].map((id) => {
          const file = files.find((f) => f._id === id);
          const itemType = file ? "files" : "folders";
          return itemType === "files"
            ? api.moveFile(id, targetParent)
            : api.moveFolder(id, targetParent);
        });

        await Promise.all(promises);

        if (onComplete) await onComplete();
        clearSelection();

        toast.success(
          `${selectedItems.size} item${
            selectedItems.size > 1 ? "s" : ""
          } moved successfully`
        );
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Bulk move failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [selectedItems, files, api, clearSelection]
  );

  return {
    selectedItems,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
    bulkRestore,
    bulkShare,
    bulkDownload,
    bulkCopy,
    bulkMove,
  };
};
