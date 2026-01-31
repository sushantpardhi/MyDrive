import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import logger from "../utils/logger";

const DriveContext = createContext();

export const useDriveContext = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error("useDriveContext must be used within a DriveProvider");
  }
  return context;
};

export const DriveProvider = ({ children }) => {
  // Helpers for persisting last locations per drive type
  const STORAGE_KEY = (type) => `lastFolderId_${type}`;
  const getStoredFolderForType = (type) =>
    localStorage.getItem(STORAGE_KEY(type)) || "root";

  // Track the current user to detect changes
  const currentUserRef = useRef(localStorage.getItem("user"));

  // Parse folder ID from URL on initial load
  const getInitialFolderId = () => {
    const path = window.location.pathname;
    // Match /drive/:folderId, /shared/:folderId, or /trash/:folderId
    const match = path.match(/^\/(drive|shared|trash)\/([a-fA-F0-9]{24})$/);
    if (match) {
      logger.debug("DriveContext: Initializing from URL", {
        folderId: match[2],
      });
      return match[2];
    }
    return "root";
  };

  // Parse drive type from URL on initial load
  const getInitialDriveType = () => {
    const path = window.location.pathname;
    if (path.startsWith("/shared")) return "shared";
    if (path.startsWith("/trash")) return "trash";
    if (path.startsWith("/drive")) return "drive";
    return localStorage.getItem("lastDriveType") || "drive";
  };

  // Persist the last visited type to restore appropriately on reloads
  const [driveType, setDriveType] = useState(getInitialDriveType); // "drive", "shared", "trash"

  // Initialize from URL if available, otherwise root
  const [currentFolderId, setCurrentFolderId] = useState(getInitialFolderId);
  const [currentFolder, setCurrentFolder] = useState(null); // Full folder object
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const resetState = useCallback(() => {
    logger.debug("DriveContext: Resetting state");
    setFolders([]);
    setFiles([]);
    setCurrentPage(1);
    setHasMore(true);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  // Reset to root folder when user changes
  useEffect(() => {
    const checkUserChange = () => {
      const currentUser = localStorage.getItem("user");
      if (currentUser !== currentUserRef.current && currentUser) {
        const userData = JSON.parse(currentUser);
        logger.info("DriveContext: User changed, resetting drive state", {
          userId: userData?.id,
        });
        currentUserRef.current = currentUser;
        setCurrentFolderId("root");
        resetState();
      }
    };

    // Check on mount
    checkUserChange();

    // Listen for storage events (user changes in other tabs)
    window.addEventListener("storage", checkUserChange);

    return () => window.removeEventListener("storage", checkUserChange);
  }, [resetState, driveType]);

  const updateCurrentFolder = useCallback(
    (folderId, typeOverride = null) => {
      const effectiveType = typeOverride || driveType;
      logger.info("DriveContext: Navigating to folder", {
        folderId,
        driveType: effectiveType,
      });
      setCurrentFolderId((prevId) => {
        localStorage.setItem(STORAGE_KEY(effectiveType), folderId);
        // If folder hasn't changed, force a reload
        if (prevId === folderId) {
          logger.debug("DriveContext: Same folder, forcing reload");
          setReloadTrigger((prev) => prev + 1);
        }
        return folderId;
      });
      // Clear state immediately to show loading
      setFolders([]);
      setFiles([]);
      setCurrentPage(1);
      setHasMore(true);
      setLoading(false);
      setLoadingMore(false);
    },
    [driveType],
  );

  const updateDriveType = useCallback(
    (type, folderOverride = null) => {
      logger.info("DriveContext: Changing drive type", { driveType: type });
      localStorage.setItem("lastDriveType", type);
      setDriveType(type);

      // Force section switches to root (or provided override)
      const targetFolder = folderOverride || "root";
      setCurrentFolderId(targetFolder);
      localStorage.setItem(STORAGE_KEY(type), targetFolder);

      resetState();
    },
    [resetState],
  );

  const addFiles = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const addFolders = useCallback((newFolders) => {
    setFolders((prev) => [...prev, ...newFolders]);
  }, []);

  const removeFile = useCallback((fileId) => {
    setFiles((prev) => prev.filter((f) => f._id !== fileId));
  }, []);

  const removeFolder = useCallback((folderId) => {
    setFolders((prev) => prev.filter((f) => f._id !== folderId));
  }, []);

  const updateFile = useCallback((fileId, updatedData) => {
    setFiles((prev) =>
      prev.map((f) => (f._id === fileId ? { ...f, ...updatedData } : f)),
    );
  }, []);

  const updateFolder = useCallback((folderId, updatedData) => {
    setFolders((prev) =>
      prev.map((f) => (f._id === folderId ? { ...f, ...updatedData } : f)),
    );
  }, []);

  const value = {
    currentFolderId,
    currentFolder,
    folders,
    files,
    loading,
    loadingMore,
    currentPage,
    hasMore,
    driveType,
    reloadTrigger,
    setReloadTrigger,
    setFolders,
    setCurrentFolder,
    setFiles,
    setLoading,
    setLoadingMore,
    setCurrentPage,
    setHasMore,
    updateCurrentFolder,
    updateDriveType,
    resetState,
    addFiles,
    addFolders,
    removeFile,
    removeFolder,
    updateFile,
    updateFolder,
  };

  return (
    <DriveContext.Provider value={value}>{children}</DriveContext.Provider>
  );
};
