import { useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { useDriveContext } from "../contexts/DriveContext";
import { useSelectionContext } from "../contexts/SelectionContext";
import logger from "../utils/logger";

/**
 * Custom hook for drag and drop functionality
 * Handles dragging files/folders and dropping them into folders
 */
export const useDragAndDrop = (
  api,
  loadFolderContents,
  folders = [],
  files = [],
) => {
  const { currentFolderId } = useDriveContext();
  const { selectedItems, clearSelection } = useSelectionContext();
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedItems, setDraggedItems] = useState([]);
  const [dropTarget, setDropTarget] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  /**
   * Validate if drop operation is allowed
   * Prevents:
   * - Dropping folder into itself
   * - Dropping folder into its children
   * - Moving trash items
   * - Invalid drop targets
   */
  const validateDrop = useCallback((draggedItemsArray, targetFolder) => {
    if (!targetFolder) {
      logger.warn("Drop validation failed: No target folder");
      return { valid: false, reason: "Invalid drop target" };
    }

    // Check if any dragged item is in trash
    const hasTrashItems = draggedItemsArray.some((item) => item.trash === true);
    if (hasTrashItems) {
      return {
        valid: false,
        reason: "Cannot move items from trash. Please restore them first.",
      };
    }

    // Check if target folder is in trash
    if (targetFolder.trash === true) {
      return {
        valid: false,
        reason: "Cannot move items to trash folder",
      };
    }

    // Check if trying to drop folder into itself
    const droppingIntoSelf = draggedItemsArray.some(
      (item) => item.itemType === "folder" && item._id === targetFolder._id,
    );
    if (droppingIntoSelf) {
      return {
        valid: false,
        reason: "Cannot move folder into itself",
      };
    }

    // Check if trying to drop folder into its own child
    // (This requires backend validation for deep nesting, handled there)
    const droppingIntoChild = draggedItemsArray.some((item) => {
      if (item.itemType !== "folder") return false;
      // Basic check: if target's parent is the dragged folder
      return targetFolder.parent === item._id;
    });
    if (droppingIntoChild) {
      return {
        valid: false,
        reason: "Cannot move folder into its own subfolder",
      };
    }

    // Check if items are already in the target folder
    const allAlreadyInTarget = draggedItemsArray.every(
      (item) => item.parent === targetFolder._id,
    );
    if (allAlreadyInTarget) {
      return {
        valid: false,
        reason: "Items are already in this folder",
      };
    }

    return { valid: true };
  }, []);

  /**
   * Handle drag start - called when user starts dragging an item
   */
  const handleDragStart = useCallback(
    (item, itemType, event) => {
      logger.info("Drag started", {
        itemId: item._id,
        itemName: item.name,
        itemType,
      });

      const itemWithType = { ...item, itemType };

      // If item is part of selection, drag all selected items
      if (selectedItems.has(item._id)) {
        // Get all selected items from the passed folders and files
        const selectedFolders = folders
          .filter((f) => selectedItems.has(f._id))
          .map((f) => ({ ...f, itemType: "folder" }));
        const selectedFiles = files
          .filter((f) => selectedItems.has(f._id))
          .map((f) => ({ ...f, itemType: "file" }));

        const allSelectedItems = [...selectedFolders, ...selectedFiles];

        // If for some reason the current item isn't in the lists (shouldn't happen usually), add it
        if (!allSelectedItems.find((i) => i._id === item._id)) {
          allSelectedItems.push(itemWithType);
        }

        logger.info("Dragging multiple items", {
          count: allSelectedItems.length,
          items: allSelectedItems.map((i) => ({ id: i._id, type: i.itemType })),
        });

        setDraggedItems(allSelectedItems);
        setDraggedItem(itemWithType); // Main dragged item for visual feedback
      } else {
        // Drag single item
        setDraggedItems([itemWithType]);
        setDraggedItem(itemWithType);
      }

      setIsDragging(true);

      // Set drag data for native drag/drop
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify(itemWithType),
        );

        // Create custom drag image
        const dragImage = event.currentTarget.cloneNode(true);
        dragImage.style.opacity = "0.7";
        dragImage.style.position = "absolute";
        dragImage.style.top = "-9999px";
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 20, 20);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      }
    },
    [selectedItems, folders, files],
  );

  /**
   * Handle drag over - called when dragging over a potential drop target
   */
  const handleDragOver = useCallback((targetFolder, event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }, []);

  /**
   * Handle drag enter - called when dragging enters a drop target
   */
  const handleDragEnter = useCallback((targetFolder, event) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current += 1;

    // Only set drop target on first enter (to handle nested elements)
    if (dragCounter.current === 1) {
      logger.debug("Drag entered drop zone", {
        targetId: targetFolder._id,
        targetName: targetFolder.name,
      });
      setDropTarget(targetFolder);
    }
  }, []);

  /**
   * Handle drag leave - called when dragging leaves a drop target
   */
  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current -= 1;

    // Only clear drop target when fully exited (to handle nested elements)
    if (dragCounter.current === 0) {
      logger.debug("Drag left drop zone");
      setDropTarget(null);
    }
  }, []);

  /**
   * Handle drop - called when item is dropped
   */
  const handleDrop = useCallback(
    async (targetFolder, event) => {
      event.preventDefault();
      event.stopPropagation();

      dragCounter.current = 0;
      setDropTarget(null);

      if (!draggedItem && !draggedItems.length) {
        logger.warn("Drop attempted with no dragged items");
        return;
      }

      const itemsToDrop = draggedItems.length ? draggedItems : [draggedItem];

      logger.info("Drop initiated", {
        itemCount: itemsToDrop.length,
        targetId: targetFolder._id,
        targetName: targetFolder.name,
      });

      // Validate drop operation
      const validation = validateDrop(itemsToDrop, targetFolder);
      if (!validation.valid) {
        toast.warn(validation.reason);
        logger.warn("Drop validation failed", {
          reason: validation.reason,
          items: itemsToDrop.map((i) => ({ id: i._id, name: i.name })),
        });
        setIsDragging(false);
        setDraggedItem(null);
        setDraggedItems([]);
        return;
      }

      try {
        // Move items
        const movePromises = itemsToDrop.map((item) => {
          const moveFunction =
            item.itemType === "folder" ? api.moveFolder : api.moveFile;
          logger.debug("Moving item", {
            itemId: item._id,
            itemName: item.name,
            itemType: item.itemType,
            targetId: targetFolder._id,
          });
          return moveFunction(item._id, targetFolder._id);
        });

        await Promise.all(movePromises);

        const itemWord = itemsToDrop.length === 1 ? "item" : "items";
        toast.success(
          `Successfully moved ${itemsToDrop.length} ${itemWord} to ${targetFolder.name}`,
        );

        logger.info("Drop completed successfully", {
          itemCount: itemsToDrop.length,
          targetFolder: targetFolder.name,
        });

        // Clear selection after successful move
        clearSelection();

        // Reload folder contents
        if (loadFolderContents) {
          await loadFolderContents();
        }
      } catch (error) {
        logger.error("Drop failed", {
          error: error.message,
          items: itemsToDrop.map((i) => ({ id: i._id, name: i.name })),
          targetFolder: targetFolder.name,
        });

        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to move items";
        toast.error(errorMessage);
      } finally {
        setIsDragging(false);
        setDraggedItem(null);
        setDraggedItems([]);
      }
    },
    [
      draggedItem,
      draggedItems,
      validateDrop,
      api,
      loadFolderContents,
      clearSelection,
    ],
  );

  /**
   * Handle drag end - cleanup when drag operation ends
   */
  const handleDragEnd = useCallback((event) => {
    event.preventDefault();
    logger.debug("Drag ended");

    dragCounter.current = 0;
    setIsDragging(false);
    setDraggedItem(null);
    setDraggedItems([]);
    setDropTarget(null);
  }, []);

  /**
   * Update dragged items when selection changes
   * This should be called from parent when multiple items are selected
   */
  const updateDraggedItems = useCallback((items) => {
    setDraggedItems(items);
  }, []);

  return {
    isDragging,
    draggedItem,
    draggedItems,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    updateDraggedItems,
  };
};

export default useDragAndDrop;
