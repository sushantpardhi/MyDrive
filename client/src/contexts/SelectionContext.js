import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

const SelectionContext = createContext();

export const useSelectionContext = () => {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error(
      "useSelectionContext must be used within a SelectionProvider"
    );
  }
  return context;
};

export const SelectionProvider = ({ children }) => {
  // Track the current user to detect changes
  const currentUserRef = useRef(localStorage.getItem("user"));
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Clear selection when user changes
  useEffect(() => {
    const checkUserChange = () => {
      const currentUser = localStorage.getItem("user");
      if (currentUser !== currentUserRef.current) {
        currentUserRef.current = currentUser;
        setSelectedItems(new Set());
      }
    };

    // Check on mount
    checkUserChange();

    // Listen for storage events (user changes in other tabs)
    window.addEventListener("storage", checkUserChange);

    return () => window.removeEventListener("storage", checkUserChange);
  }, []);

  const toggleSelection = useCallback((itemId) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((allItemIds) => {
    setSelectedItems(new Set(allItemIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback(
    (itemId) => {
      return selectedItems.has(itemId);
    },
    [selectedItems]
  );

  const getSelectedCount = useCallback(() => {
    return selectedItems.size;
  }, [selectedItems]);

  const getSelectedItemIds = useCallback(() => {
    return Array.from(selectedItems);
  }, [selectedItems]);

  const value = {
    selectedItems,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedCount,
    getSelectedItemIds,
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
};
