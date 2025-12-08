import { useState, useRef, useCallback, useEffect } from "react";
import { useSelectionContext } from "../contexts/SelectionContext";
import logger from "../utils/logger";

/**
 * Custom hook for drag-to-select (lasso selection) functionality
 * Allows users to click and drag to create a selection box
 * @param {Array} folders - Array of folder objects
 * @param {Array} files - Array of file objects
 * @param {Object} containerRef - Ref to the container element
 * @returns {Object} - Drag selection state and handlers
 */
export const useDragSelect = (folders, files, containerRef) => {
  const { selectAll, clearSelection } = useSelectionContext();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  const startPointRef = useRef({ x: 0, y: 0 });
  const isMouseDownRef = useRef(false);
  const selectedItemsRef = useRef(new Set());

  /**
   * Get all item elements with their IDs and bounding rectangles
   */
  const getItemElements = useCallback(() => {
    if (!containerRef.current) return [];

    const elements = [];
    const allItems = [...folders, ...files];

    allItems.forEach((item) => {
      const element = containerRef.current.querySelector(
        `[data-item-id="${item._id}"]`
      );
      if (element) {
        const rect = element.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate relative position to container
        elements.push({
          id: item._id,
          rect: {
            left:
              rect.left - containerRect.left + containerRef.current.scrollLeft,
            top: rect.top - containerRect.top + containerRef.current.scrollTop,
            right:
              rect.right - containerRect.left + containerRef.current.scrollLeft,
            bottom:
              rect.bottom - containerRect.top + containerRef.current.scrollTop,
            width: rect.width,
            height: rect.height,
          },
        });
      }
    });

    return elements;
  }, [folders, files, containerRef]);

  /**
   * Check if two rectangles intersect
   */
  const doRectsIntersect = useCallback((rect1, rect2) => {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  }, []);

  /**
   * Get items that intersect with the selection box
   */
  const getIntersectingItems = useCallback(
    (box) => {
      const elements = getItemElements();
      const intersecting = new Set();

      elements.forEach(({ id, rect }) => {
        if (doRectsIntersect(box, rect)) {
          intersecting.add(id);
        }
      });

      return intersecting;
    },
    [getItemElements, doRectsIntersect]
  );

  /**
   * Handle mouse down - start selection
   */
  const handleMouseDown = useCallback(
    (e) => {
      // Only start selection on left click
      if (e.button !== 0) return;

      // Don't start selection if clicking on an item (let normal click handling work)
      const target = e.target;
      const isItem = target.closest("[data-item-id]");

      // Allow selection if clicking directly on the container background
      if (isItem) return;

      // Prevent text selection during drag
      e.preventDefault();

      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const x =
        e.clientX - containerRect.left + containerRef.current.scrollLeft;
      const y = e.clientY - containerRect.top + containerRef.current.scrollTop;

      startPointRef.current = { x, y };
      isMouseDownRef.current = true;
      selectedItemsRef.current = new Set();

      logger.debug("Drag selection started", { x, y });
    },
    [containerRef]
  );

  /**
   * Handle mouse move - update selection box
   */
  const handleMouseMove = useCallback(
    (e) => {
      if (!isMouseDownRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const currentX =
        e.clientX - containerRect.left + containerRef.current.scrollLeft;
      const currentY =
        e.clientY - containerRect.top + containerRef.current.scrollTop;

      const left = Math.min(startPointRef.current.x, currentX);
      const top = Math.min(startPointRef.current.y, currentY);
      const width = Math.abs(currentX - startPointRef.current.x);
      const height = Math.abs(currentY - startPointRef.current.y);

      // Only show selection box if moved more than 5 pixels (avoid accidental selections)
      if (width > 5 || height > 5) {
        if (!isSelecting) {
          setIsSelecting(true);
          logger.debug("Drag selection box visible");
        }

        const box = {
          left,
          top,
          right: left + width,
          bottom: top + height,
          width,
          height,
        };
        setSelectionBox(box);

        // Get intersecting items and update selection
        const intersecting = getIntersectingItems(box);
        if (intersecting.size > 0 || selectedItemsRef.current.size > 0) {
          selectedItemsRef.current = intersecting;
          selectAll(Array.from(intersecting));
        }
      }
    },
    [isSelecting, containerRef, getIntersectingItems, selectAll]
  );

  /**
   * Handle mouse up - end selection
   */
  const handleMouseUp = useCallback(() => {
    if (!isMouseDownRef.current) return;

    isMouseDownRef.current = false;

    // If we were selecting, finalize the selection
    if (isSelecting) {
      logger.info("Drag selection completed", {
        selectedCount: selectedItemsRef.current.size,
      });
    }

    // Reset selection box
    setTimeout(() => {
      setIsSelecting(false);
      setSelectionBox({ left: 0, top: 0, width: 0, height: 0 });
    }, 0);
  }, [isSelecting]);

  /**
   * Handle mouse leave - cancel selection if mouse leaves container
   */
  const handleMouseLeave = useCallback(() => {
    if (isMouseDownRef.current && isSelecting) {
      handleMouseUp();
    }
  }, [isSelecting, handleMouseUp]);

  // Attach global mouse up listener to handle mouse up outside container
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isMouseDownRef.current) {
        handleMouseUp();
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleMouseUp]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMouseDownRef.current = false;
      selectedItemsRef.current = new Set();
    };
  }, []);

  return {
    isSelecting,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseLeave,
  };
};
