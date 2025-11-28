import { useCallback } from "react";
import { toast } from "react-toastify";
import { downloadFile } from "../utils/helpers";
import { useSelectionContext } from "../contexts/SelectionContext";

export const useSelection = (api, folders, files, type) => {
  const {
    selectedItems,
    selectAll: selectAllContext,
    toggleSelection,
    clearSelection,
  } = useSelectionContext();

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
    async (onComplete) => {
      if (!selectedItems.size) return false;

      const confirmMessage =
        type === "trash"
          ? `Are you sure you want to permanently delete ${selectedItems.size} items? This cannot be undone.`
          : `Are you sure you want to move ${selectedItems.size} items to trash?`;

      if (!window.confirm(confirmMessage)) return false;

      try {
        const promises = [...selectedItems].map((id) => {
          const itemType = files.find((f) => f._id === id)
            ? "files"
            : "folders";
          return type === "trash"
            ? api.deleteItemPermanently(itemType, id)
            : api.moveToTrash(itemType, id);
        });

        await Promise.all(promises);

        if (onComplete) await onComplete();
        clearSelection();

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
    [selectedItems, files, type, api, clearSelection]
  );

  const bulkRestore = useCallback(async () => {
    if (!selectedItems.size) return false;

    try {
      const promises = [...selectedItems].map((id) => {
        const itemType = files.find((f) => f._id === id) ? "files" : "folders";
        return api.restoreFromTrash(itemType, id);
      });

      await Promise.all(promises);
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

  const bulkShare = useCallback(async () => {
    if (!selectedItems.size) return false;

    const userEmail = prompt("Enter user email to share with:");
    if (!userEmail?.trim()) return false;

    try {
      const promises = [...selectedItems].map((id) => {
        const itemType = files.find((f) => f._id === id) ? "files" : "folders";
        return api.shareItem(itemType, id, userEmail);
      });

      await Promise.all(promises);
      toast.success("Items shared successfully");
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Bulk share failed";
      toast.error(errorMsg);
      console.error(error);
      return false;
    }
  }, [selectedItems, files, api]);

  const bulkDownload = useCallback(async () => {
    const selectedFiles = files.filter((f) => selectedItems.has(f._id));
    if (!selectedFiles.length) return false;

    try {
      for (const file of selectedFiles) {
        await downloadFile(api, file._id, file.name);
      }
      toast.success("Files downloaded successfully");
      return true;
    } catch (error) {
      toast.error("Bulk download failed");
      console.error(error);
      return false;
    }
  }, [selectedItems, files, api]);

  return {
    selectedItems,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
    bulkRestore,
    bulkShare,
    bulkDownload,
  };
};
