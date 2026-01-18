import { createContext, useContext, useState, useCallback } from "react";
import LoadingSpinner from "../components/common/LoadingSpinner";
import logger from "../utils/logger";

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

  // Global loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingType, setLoadingType] = useState("overlay"); // "overlay" or "fullscreen"

  // Dialog states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState(null);
  const [shareItems, setShareItems] = useState([]); // For bulk operations
  const [shareItemType, setShareItemType] = useState(null);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [renameItemType, setRenameItemType] = useState(null);

  const [copyMoveDialogOpen, setCopyMoveDialogOpen] = useState(false);
  const [copyMoveItem, setCopyMoveItem] = useState(null);
  const [copyMoveItems, setCopyMoveItems] = useState([]); // For bulk operations
  const [copyMoveItemType, setCopyMoveItemType] = useState(null);
  const [copyMoveOperation, setCopyMoveOperation] = useState("copy");

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewFileList, setPreviewFileList] = useState([]);
  const [previewFileIndex, setPreviewFileIndex] = useState(-1);

  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState(null);
  const [propertiesItemType, setPropertiesItemType] = useState(null);

  // Storage refresh trigger
  const [storageRefreshTrigger, setStorageRefreshTrigger] = useState(0);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const refreshStorage = useCallback(() => {
    logger.debug("Storage refresh triggered");
    setStorageRefreshTrigger((prev) => prev + 1);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Global loading handlers
  const showLoading = useCallback((message = "", type = "overlay") => {
    setIsLoading(true);
    setLoadingMessage(message);
    setLoadingType(type);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage("");
  }, []);

  const openShareDialog = useCallback((item, itemType) => {
    setShareItem(item);
    setShareItems([]); // Clear bulk items for single item share
    setShareItemType(itemType);
    setShareDialogOpen(true);
  }, []);

  const openBulkShareDialog = useCallback((items) => {
    setShareItem(null); // Clear single item for bulk share
    setShareItems(items);
    setShareItemType("bulk");
    setShareDialogOpen(true);
  }, []);

  const closeShareDialog = useCallback(() => {
    setShareDialogOpen(false);
    setShareItem(null);
    setShareItems([]);
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
    setCopyMoveItems([]); // Clear bulk items when opening for single item
    setCopyMoveItemType(itemType);
    setCopyMoveOperation(operation);
    setCopyMoveDialogOpen(true);
  }, []);

  const openBulkCopyMoveDialog = useCallback((items, operation) => {
    setCopyMoveItem(null); // Clear single item when opening for bulk
    setCopyMoveItems(items);
    setCopyMoveItemType("bulk"); // Special type for bulk operations
    setCopyMoveOperation(operation);
    setCopyMoveDialogOpen(true);
  }, []);

  const closeCopyMoveDialog = useCallback(() => {
    setCopyMoveDialogOpen(false);
    setCopyMoveItem(null);
    setCopyMoveItems([]);
    setCopyMoveItemType(null);
    setCopyMoveOperation("copy");
  }, []);

  const openPreviewModal = useCallback((file, fileList = []) => {
    setPreviewFile(file);
    setPreviewFileList(fileList);
    const index = fileList.findIndex((f) => f._id === file._id);
    setPreviewFileIndex(index);
    setPreviewModalOpen(true);
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewModalOpen(false);
    setPreviewFile(null);
    setPreviewFileList([]);
    setPreviewFileIndex(-1);
  }, []);

  const navigatePreviewFile = useCallback((direction) => {
    if (previewFileList.length === 0) return;
    
    let newIndex = previewFileIndex + direction;
    
    // Wrap around
    if (newIndex < 0) {
      newIndex = previewFileList.length - 1;
    } else if (newIndex >= previewFileList.length) {
      newIndex = 0;
    }
    
    const newFile = previewFileList[newIndex];
    if (newFile) {
      setPreviewFile(newFile);
      setPreviewFileIndex(newIndex);
    }
  }, [previewFileList, previewFileIndex]);

  const goToPreviousFile = useCallback(() => {
    navigatePreviewFile(-1);
  }, [navigatePreviewFile]);

  const goToNextFile = useCallback(() => {
    navigatePreviewFile(1);
  }, [navigatePreviewFile]);

  const openPropertiesModal = useCallback((item, itemType) => {
    setPropertiesItem(item);
    setPropertiesItemType(itemType);
    setPropertiesModalOpen(true);
  }, []);

  const closePropertiesModal = useCallback(() => {
    setPropertiesModalOpen(false);
    setPropertiesItem(null);
    setPropertiesItemType(null);
  }, []);

  const value = {
    sidebarOpen,
    actionsMenuOpen,
    setActionsMenuOpen,
    toggleSidebar,
    closeSidebar,

    // Global loading state
    isLoading,
    loadingMessage,
    showLoading,
    hideLoading,

    // Dialog states and handlers
    shareDialogOpen,
    shareItem,
    shareItems,
    shareItemType,
    openShareDialog,
    openBulkShareDialog,
    closeShareDialog,

    renameDialogOpen,
    renameItem,
    renameItemType,
    openRenameDialog,
    closeRenameDialog,

    copyMoveDialogOpen,
    copyMoveItem,
    copyMoveItems,
    copyMoveItemType,
    copyMoveOperation,
    openCopyMoveDialog,
    openBulkCopyMoveDialog,
    closeCopyMoveDialog,

    previewModalOpen,
    previewFile,
    previewFileList,
    previewFileIndex,
    openPreviewModal,
    closePreviewModal,
    goToPreviousFile,
    goToNextFile,

    propertiesModalOpen,
    propertiesItem,
    propertiesItemType,
    openPropertiesModal,
    closePropertiesModal,
    storageRefreshTrigger,
    refreshStorage,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
      {isLoading && (
        <LoadingSpinner
          fullscreen={loadingType === "fullscreen"}
          overlay={loadingType === "overlay"}
          message={loadingMessage}
          size="large"
        />
      )}
    </UIContext.Provider>
  );
};
