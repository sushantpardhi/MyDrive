import { createContext, useContext, useState, useCallback } from "react";

const UIContext = createContext();

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within a UIProvider");
  }
  return context;
};

export const UIProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // Dialog states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [shareItemType, setShareItemType] = useState(null);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [renameItemType, setRenameItemType] = useState(null);

  const [copyMoveDialogOpen, setCopyMoveDialogOpen] = useState(false);
  const [copyMoveItem, setCopyMoveItem] = useState(null);
  const [copyMoveItemType, setCopyMoveItemType] = useState(null);
  const [copyMoveOperation, setCopyMoveOperation] = useState("copy");

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const openShareDialog = useCallback((item, itemType) => {
    setShareItem(item);
    setShareItemType(itemType);
    setShareDialogOpen(true);
  }, []);

  const closeShareDialog = useCallback(() => {
    setShareDialogOpen(false);
    setShareItem(null);
    setShareItemType(null);
  }, []);

  const openRenameDialog = useCallback((item, itemType) => {
    setRenameItem(item);
    setRenameItemType(itemType);
    setRenameDialogOpen(true);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setRenameDialogOpen(false);
    setRenameItem(null);
    setRenameItemType(null);
  }, []);

  const openCopyMoveDialog = useCallback((item, itemType, operation) => {
    setCopyMoveItem(item);
    setCopyMoveItemType(itemType);
    setCopyMoveOperation(operation);
    setCopyMoveDialogOpen(true);
  }, []);

  const closeCopyMoveDialog = useCallback(() => {
    setCopyMoveDialogOpen(false);
    setCopyMoveItem(null);
    setCopyMoveItemType(null);
    setCopyMoveOperation("copy");
  }, []);

  const value = {
    sidebarOpen,
    actionsMenuOpen,
    setActionsMenuOpen,
    toggleSidebar,
    closeSidebar,

    // Dialog states and handlers
    shareDialogOpen,
    shareItem,
    shareItemType,
    openShareDialog,
    closeShareDialog,

    renameDialogOpen,
    renameItem,
    renameItemType,
    openRenameDialog,
    closeRenameDialog,

    copyMoveDialogOpen,
    copyMoveItem,
    copyMoveItemType,
    copyMoveOperation,
    openCopyMoveDialog,
    closeCopyMoveDialog,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
