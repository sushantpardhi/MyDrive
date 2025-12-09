import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import logger from "../../utils/logger";

// Components
import Header from "./Header";
import LocationHeader from "./LocationHeader";
import MobileBreadcrumb from "./MobileBreadcrumb";
import DriveContent from "./DriveContent";
import FloatingActionButton from "./FloatingActionButton";
import ShareDialog from "../files/ShareDialog";
import RenameDialog from "../files/RenameDialog";
import CopyMoveDialog from "../files/CopyMoveDialog";
import PropertiesModal from "../files/PropertiesModal";
import PasswordConfirmModal from "../common/PasswordConfirmModal";

// Hooks
import { useFileOperations } from "../../hooks/useFileOperations";
import { useSearch } from "../../hooks/useSearch";
import { useSelection } from "../../hooks/useSelection";
import { useBreadcrumbs } from "../../hooks/useBreadcrumbs";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useUploadWarning } from "../../hooks/useUploadWarning";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { usePasswordConfirmation } from "../../hooks/usePasswordConfirmation";
import { useDragSelect } from "../../hooks/useDragSelect";

// Contexts
import { useDriveContext } from "../../contexts/DriveContext";
import { useSelectionContext } from "../../contexts/SelectionContext";
import { useUIContext } from "../../contexts/UIContext";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { useTransfer } from "../../contexts/TransferContext";

// Services
import api from "../../services/api";

// Styles
import styles from "./DriveView.module.css";

const DriveView = ({ type = "drive", onMenuClick }) => {
  // Context data
  const {
    folders,
    files,
    loading,
    loadingMore,
    currentPage,
    hasMore,
    setFolders,
    setFiles,
    setLoading,
    setLoadingMore,
    setCurrentPage,
    setHasMore,
    currentFolderId,
    updateCurrentFolder,
    reloadTrigger,
  } = useDriveContext();

  const { selectedItems, toggleSelection, selectAll, clearSelection } =
    useSelectionContext();

  const {
    actionsMenuOpen,
    setActionsMenuOpen,
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
    propertiesModalOpen,
    propertiesItem,
    propertiesItemType,
    openPropertiesModal,
    closePropertiesModal,
  } = useUIContext();

  // Refs
  const fileInputRef = useRef(null);
  const driveViewRef = useRef(null);
  const typeRef = useRef(type);
  const sortByRef = useRef("createdAt");
  const sortOrderRef = useRef("desc");
  const dragCounterRef = useRef(0);

  // State for external drag
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);

  // Password confirmation for permanent deletion
  const {
    isModalOpen: isPasswordModalOpen,
    modalMessage: passwordModalMessage,
    showPasswordModal,
    handlePasswordConfirm,
    handleModalClose: handlePasswordModalClose,
  } = usePasswordConfirmation();

  // Custom hooks
  const { viewMode, itemsPerPage, changeViewMode } = useUserSettings();
  const { path, breadcrumbRef, navigateTo, openFolder } = useBreadcrumbs(type);

  const loadFolderContents = useCallback(
    async (folderId = "root", page = 1, append = false) => {
      try {
        if (page === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        let response;
        if (type === "shared" && folderId === "root") {
          response = await api.getSharedItems(page, itemsPerPage);
        } else {
          response = await api.getFolderContents(
            folderId,
            type === "trash",
            page,
            itemsPerPage,
            sortByRef.current,
            sortOrderRef.current
          );
        }

        if (append) {
          setFolders((prev) => {
            const existingIds = new Set(prev.map((f) => f._id));
            const newFolders = (response.data.folders || []).filter(
              (f) => !existingIds.has(f._id)
            );
            return [...prev, ...newFolders];
          });
          setFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f._id));
            const newFiles = (response.data.files || []).filter(
              (f) => !existingIds.has(f._id)
            );
            return [...prev, ...newFiles];
          });
        } else {
          setFolders(response.data.folders || []);
          setFiles(response.data.files || []);
        }

        setHasMore(response.data.pagination?.hasMore || false);
        setCurrentPage(page);
      } catch (error) {
        toast.error("Failed to load folder contents");
        logger.logError(error, "Failed to load folder contents", {
          folderId,
          page,
          isInitialLoad,
          type,
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      type,
      itemsPerPage,
      setLoading,
      setLoadingMore,
      setFolders,
      setFiles,
      setHasMore,
      setCurrentPage,
    ]
  );

  // Use global transfer context instead of local hooks
  const transferContext = useTransfer();
  const uploadProgressHook = {
    uploadProgress: transferContext.uploadProgress,
    uploading: transferContext.uploading,
    startUpload: transferContext.startUpload,
    updateProgress: transferContext.updateProgress,
    completeUpload: transferContext.completeUpload,
    failUpload: transferContext.failUpload,
    cancelUpload: transferContext.cancelUpload,
    cancelAll: transferContext.cancelAll,
    resetProgress: transferContext.resetProgress,
    registerChunkService: transferContext.registerChunkService,
    unregisterChunkService: transferContext.unregisterChunkService,
    updateChunkProgress: transferContext.updateChunkProgress,
    completeChunk: transferContext.completeChunk,
    retryChunk: transferContext.retryChunk,
  };

  const downloadProgressHook = {
    downloadProgress: transferContext.downloadProgress,
    startDownload: transferContext.startDownload,
    updateProgress: transferContext.updateDownloadProgress,
    updateZippingProgress: transferContext.updateZippingProgress,
    completeDownload: transferContext.completeDownload,
    failDownload: transferContext.failDownload,
    cancelDownload: transferContext.cancelDownload,
    resetProgress: transferContext.resetDownloadProgress,
  };

  // Warn user before leaving page during active uploads
  useUploadWarning(uploadProgressHook.uploading);

  const {
    createFolder,
    uploadFiles,
    deleteItem,
    handleDownload,
    handleFolderDownload,
    restoreItem,
    emptyTrash,
    renameItem: renameItemOperation,
    copyItem,
    moveItem,
  } = useFileOperations(
    api,
    loadFolderContents,
    uploadProgressHook,
    downloadProgressHook
  );

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    clearSearch,
    loadMoreSearchResults,
    hasMore: searchHasMore,
    searchFilters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    searchHistory,
  } = useSearch(api, loadFolderContents, itemsPerPage);

  const {
    bulkDelete,
    bulkRestore,
    bulkShare,
    bulkDownload,
    bulkCopy,
    bulkMove,
  } = useSelection(api, folders, files, type);

  // Drag and drop functionality
  const {
    isDragging,
    draggedItem,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop(api, loadFolderContents);

  // Drag select functionality (lasso selection)
  const {
    isSelecting,
    selectionBox,
    handleMouseDown: handleDragSelectMouseDown,
    handleMouseMove: handleDragSelectMouseMove,
    handleMouseLeave: handleDragSelectMouseLeave,
  } = useDragSelect(folders, files, driveViewRef);

  // Check if filters are active (needed before useEffect below)
  const hasFiltersActive =
    searchFilters.fileTypes.length > 0 ||
    searchFilters.sizeMin !== "" ||
    searchFilters.sizeMax !== "" ||
    searchFilters.dateStart !== "" ||
    searchFilters.dateEnd !== "";

  // Update sort refs when search filters change and reload if not searching
  useEffect(() => {
    const sortChanged =
      sortByRef.current !== searchFilters.sortBy ||
      sortOrderRef.current !== searchFilters.sortOrder;

    if (sortChanged) {
      sortByRef.current = searchFilters.sortBy;
      sortOrderRef.current = searchFilters.sortOrder;

      // Only reload if not actively searching (search handles its own sorting)
      if (!searchQuery.trim() && !hasFiltersActive) {
        loadFolderContents(currentFolderId, 1, false);
      }
    }
  }, [
    searchFilters.sortBy,
    searchFilters.sortOrder,
    searchQuery,
    hasFiltersActive,
    loadFolderContents,
    currentFolderId,
  ]);

  // Get current data to display (search/filter results or regular folder contents)
  const displayFolders =
    searchQuery.trim() || hasFiltersActive ? searchResults.folders : folders;
  const displayFiles =
    searchQuery.trim() || hasFiltersActive ? searchResults.files : files;
  const allItemIds = useMemo(
    () => [
      ...displayFolders.map((f) => f._id),
      ...displayFiles.map((f) => f._id),
    ],
    [displayFolders, displayFiles]
  );

  // Infinite scroll
  useInfiniteScroll({
    containerRef: driveViewRef,
    loading,
    loadingMore,
    hasMore,
    searchHasMore,
    currentPage,
    currentFolderId,
    searchQuery,
    loadFolderContents,
    loadMoreSearchResults,
  });

  // Reset to root folder when type changes (but not on initial mount)
  const initialMountRef = useRef(true);
  useEffect(() => {
    // Skip on initial mount - let DriveContext's saved lastFolderId take effect
    if (initialMountRef.current) {
      initialMountRef.current = false;
      typeRef.current = type;
      return;
    }

    // Only reset if type actually changed
    if (typeRef.current !== type) {
      typeRef.current = type;
      updateCurrentFolder("root");
      // Breadcrumb will auto-update via useBreadcrumbs hook
    }
  }, [type, updateCurrentFolder]);

  // Load folder contents when currentFolderId changes or reloadTrigger fires
  useEffect(() => {
    loadFolderContents(currentFolderId);
    // loadFolderContents is stable (wrapped in useCallback with stable dependencies)
    // Only react to currentFolderId and reloadTrigger changes
    // eslint-disable-next-line
  }, [currentFolderId, reloadTrigger]);

  // Reset selections when changing folders or type
  useEffect(() => {
    clearSelection();
  }, [currentFolderId, type, clearSelection]);

  // Wrapper for openFolder that clears search when navigating to a folder
  const handleOpenFolder = useCallback(
    (folder) => {
      // Clear search state when opening a folder
      clearSearch();
      // Open the folder
      openFolder(folder);
    },
    [openFolder, clearSearch]
  );

  // Toggle select all handler
  const handleToggleSelectAll = useCallback(() => {
    const allSelected =
      allItemIds.length > 0 && allItemIds.every((id) => selectedItems.has(id));
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allItemIds);
    }
  }, [allItemIds, selectedItems, selectAll, clearSelection]);

  // Keyboard shortcuts for selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleToggleSelectAll();
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSelectAll, clearSelection]);

  // Event handlers
  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (!uploadedFiles.length) return;

    const newFiles = await uploadFiles(uploadedFiles);
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const handleCreateFolder = async () => {
    const newFolder = await createFolder();
    if (newFolder) {
      setFolders((prev) => [...prev, newFolder]);
    }
  };

  const handleDelete = async (id, itemType) => {
    const isPermanent = type === "trash";
    const success = await deleteItem(
      id,
      itemType,
      isPermanent,
      isPermanent ? showPasswordModal : null
    );
    if (success) {
      await loadFolderContents(currentFolderId, 1, false);
      clearSelection();
    }
  };

  const handleBulkDelete = async () => {
    const isPermanent = type === "trash";
    const success = await bulkDelete(
      () => loadFolderContents(currentFolderId, 1, false),
      isPermanent ? showPasswordModal : null
    );
    if (success) {
      clearSelection();
    }
  };

  const handleBulkRestore = async () => {
    const success = await bulkRestore();
    if (success) {
      setFiles(files.filter((f) => !selectedItems.has(f._id)));
      setFolders(folders.filter((f) => !selectedItems.has(f._id)));
      clearSelection();
    }
  };

  const handleEmptyTrash = async () => {
    const success = await emptyTrash(showPasswordModal);
    if (success) {
      setFiles([]);
      setFolders([]);
      clearSelection();
    }
  };

  const handleRestore = async (id, itemType) => {
    const success = await restoreItem(id, itemType);
    if (success) {
      if (itemType === "files") {
        setFiles(files.filter((f) => f._id !== id));
      } else {
        setFolders(folders.filter((f) => f._id !== id));
      }
      clearSelection();
    }
  };

  // Dialog handlers
  const handleShareDialogClose = () => {
    // Clear selection if it was a bulk share operation
    if (shareItems && shareItems.length > 0) {
      clearSelection();
    }
    closeShareDialog();
    loadFolderContents(currentFolderId, 1, false);
  };

  const handleRename = async (id, name, itemType) => {
    try {
      const success = await renameItemOperation(id, name, itemType);
      if (success) {
        await loadFolderContents(currentFolderId, 1, false);
      }
      return success;
    } catch (error) {
      throw error;
    }
  };

  const handleCopyMove = async (...args) => {
    try {
      // Check if this is a bulk operation (2 parameters) or single operation (5 parameters)
      const isBulkOperation = args.length === 2;

      if (isBulkOperation) {
        // Bulk operation: handleCopyMove(targetParent, operation)
        const [targetParent, bulkOperation] = args;

        if (bulkOperation === "copy") {
          await bulkCopy(targetParent, async () => {
            await loadFolderContents(currentFolderId, 1, false);
          });
        } else {
          await bulkMove(targetParent, async () => {
            await loadFolderContents(currentFolderId, 1, false);
          });
        }
        return true;
      } else {
        // Single item operation: handleCopyMove(id, parent, itemType, operation, name)
        const [id, parent, itemType, operation, name = null] = args;

        let success;
        if (operation === "copy") {
          success = await copyItem(id, parent, itemType, name);
        } else {
          success = await moveItem(id, parent, itemType);
        }

        if (success) {
          await loadFolderContents(currentFolderId, 1, false);
        }
        return success;
      }
    } catch (error) {
      throw error;
    }
  };

  const handleBulkCopy = () => {
    const selectedItemsList = [...selectedItems].map((id) => {
      const file = files.find((f) => f._id === id);
      const folder = folders.find((f) => f._id === id);
      return file || folder;
    });
    openBulkCopyMoveDialog(selectedItemsList, "copy");
  };

  const handleBulkMove = () => {
    const selectedItemsList = [...selectedItems].map((id) => {
      const file = files.find((f) => f._id === id);
      const folder = folders.find((f) => f._id === id);
      return file || folder;
    });
    openBulkCopyMoveDialog(selectedItemsList, "move");
  };

  const handleBulkShare = () => {
    const selectedItemsList = bulkShare();
    if (selectedItemsList.length > 0) {
      openBulkShareDialog(selectedItemsList);
    }
  };

  const handleFileProperties = (file) => {
    openPropertiesModal(file, "file");
  };

  const handleFolderProperties = (folder) => {
    openPropertiesModal(folder, "folder");
  };

  // Handle external file drop (from file system)
  const handleExternalDrop = useCallback(
    async (e) => {
      // Don't prevent default or stop propagation here
      // Let folder cards handle their own drops first

      dragCounterRef.current = 0;
      setIsDraggingExternal(false);

      // Check if the drop target is a folder card - if so, don't handle it here
      const target = e.target;
      const isFolderCard = target.closest('[role="group"]');
      if (isFolderCard) {
        return; // Let folder card handle the drop
      }

      e.preventDefault();
      e.stopPropagation();

      // Check if this is an external file drop (not internal drag)
      const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
      if (!hasFiles) {
        return; // Internal drag handled by useDragAndDrop hook
      }

      logger.info("External files dropped", {
        fileCount: e.dataTransfer.files.length,
        currentFolder: currentFolderId,
      });

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        toast.info(`Uploading ${droppedFiles.length} file(s)...`);
        const newFiles = await uploadFiles(droppedFiles);
        if (newFiles.length > 0) {
          setFiles((prev) => [...prev, ...newFiles]);
        }
      }
    },
    [uploadFiles, setFiles, currentFolderId]
  );

  const handleExternalDragOver = useCallback((e) => {
    // Don't stop propagation - let folder cards handle their own drag over
    const target = e.target;
    const isFolderCard = target.closest('[role="group"]');
    if (isFolderCard) {
      return; // Let folder card handle drag over
    }

    e.preventDefault();
    // Set dropEffect to copy to show the appropriate cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleExternalDragEnter = useCallback((e) => {
    // Don't stop propagation
    dragCounterRef.current += 1;

    // Only set state on first enter
    if (dragCounterRef.current === 1) {
      // Check if this is an external file drag
      const types = e.dataTransfer.types;
      const hasFiles = types && types.includes("Files");
      if (hasFiles) {
        setIsDraggingExternal(true);
      }
    }
  }, []);

  const handleExternalDragLeave = useCallback((e) => {
    // Don't stop propagation
    dragCounterRef.current -= 1;

    // Only clear state when fully exited
    if (dragCounterRef.current === 0) {
      setIsDraggingExternal(false);
    }
  }, []);

  // Setup external drop listeners on driveViewRef
  useEffect(() => {
    const driveElement = driveViewRef.current;
    if (!driveElement) return;

    driveElement.addEventListener("drop", handleExternalDrop);
    driveElement.addEventListener("dragover", handleExternalDragOver);
    driveElement.addEventListener("dragenter", handleExternalDragEnter);
    driveElement.addEventListener("dragleave", handleExternalDragLeave);

    return () => {
      driveElement.removeEventListener("drop", handleExternalDrop);
      driveElement.removeEventListener("dragover", handleExternalDragOver);
      driveElement.removeEventListener("dragenter", handleExternalDragEnter);
      driveElement.removeEventListener("dragleave", handleExternalDragLeave);
    };
  }, [
    handleExternalDrop,
    handleExternalDragOver,
    handleExternalDragEnter,
    handleExternalDragLeave,
  ]);

  return (
    <div
      className={`${styles.driveContainer} ${
        isDraggingExternal ? styles.dragOverlay : ""
      }`}
    >
      <Header
        onMenuClick={onMenuClick}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        clearSearch={clearSearch}
        type={type}
        onCreateFolder={handleCreateFolder}
        onFileUpload={handleFileUpload}
        onEmptyTrash={handleEmptyTrash}
        fileInputRef={fileInputRef}
        onBulkDownload={bulkDownload}
        onBulkShare={handleBulkShare}
        onBulkDelete={handleBulkDelete}
        onBulkRestore={handleBulkRestore}
        onBulkCopy={handleBulkCopy}
        onBulkMove={handleBulkMove}
        searchFilters={searchFilters}
        updateFilters={updateFilters}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        searchHistory={searchHistory}
      />

      <LocationHeader
        type={type}
        locationName={path[path.length - 1]?.name}
        viewMode={viewMode}
        setViewMode={changeViewMode}
        allItemIds={allItemIds}
        onSelectAll={handleToggleSelectAll}
        path={path}
        navigateTo={navigateTo}
        breadcrumbRef={breadcrumbRef}
      />

      <MobileBreadcrumb path={path} navigateTo={navigateTo} />

      <DriveContent
        loading={loading}
        loadingMore={loadingMore}
        isSearching={isSearching}
        folders={displayFolders}
        files={displayFiles}
        viewMode={viewMode}
        onFolderClick={handleOpenFolder}
        onFolderDelete={(id) => handleDelete(id, "folders")}
        onFolderShare={(folder) => openShareDialog(folder, "folders")}
        onFolderRestore={(id) => handleRestore(id, "folders")}
        onFolderRename={(folder) => openRenameDialog(folder, "folders")}
        onFolderCopy={(folder) => openCopyMoveDialog(folder, "folders", "copy")}
        onFolderMove={(folder) => openCopyMoveDialog(folder, "folders", "move")}
        onFolderDownload={(folderId, folderName) =>
          handleFolderDownload(folderId, folderName)
        }
        onFolderProperties={handleFolderProperties}
        onFileDownload={handleDownload}
        onFileDelete={(id) => handleDelete(id, "files")}
        onFileShare={(file) => openShareDialog(file, "files")}
        onFileRestore={(id) => handleRestore(id, "files")}
        onFileRename={(file) => openRenameDialog(file, "files")}
        onFileCopy={(file) => openCopyMoveDialog(file, "files", "copy")}
        onFileMove={(file) => openCopyMoveDialog(file, "files", "move")}
        onFileProperties={handleFileProperties}
        onToggleSelection={toggleSelection}
        onSelectAll={handleToggleSelectAll}
        type={type}
        driveViewRef={driveViewRef}
        searchQuery={searchQuery}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggedItem={draggedItem}
        dropTarget={dropTarget}
        isSelecting={isSelecting}
        selectionBox={selectionBox}
        onDragSelectMouseDown={handleDragSelectMouseDown}
        onDragSelectMouseMove={handleDragSelectMouseMove}
        onDragSelectMouseLeave={handleDragSelectMouseLeave}
      />

      <FloatingActionButton
        type={type}
        isOpen={actionsMenuOpen}
        setIsOpen={setActionsMenuOpen}
        onCreateFolder={handleCreateFolder}
        onFileUpload={handleFileUpload}
        onEmptyTrash={handleEmptyTrash}
        fileInputRef={fileInputRef}
      />

      {/* Dialogs */}
      <ShareDialog
        isOpen={shareDialogOpen}
        item={shareItem}
        items={shareItems}
        itemType={shareItemType}
        onClose={handleShareDialogClose}
      />

      <RenameDialog
        isOpen={renameDialogOpen}
        onClose={closeRenameDialog}
        onRename={handleRename}
        item={renameItem}
        itemType={renameItemType}
      />

      <CopyMoveDialog
        isOpen={copyMoveDialogOpen}
        onClose={closeCopyMoveDialog}
        onCopyMove={handleCopyMove}
        item={copyMoveItem}
        items={copyMoveItems}
        itemType={copyMoveItemType}
        operation={copyMoveOperation}
      />

      <PropertiesModal
        isOpen={propertiesModalOpen}
        item={propertiesItem}
        itemType={propertiesItemType}
        onClose={closePropertiesModal}
      />

      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={handlePasswordModalClose}
        onConfirm={handlePasswordConfirm}
        message={passwordModalMessage}
      />
    </div>
  );
};

export default DriveView;
