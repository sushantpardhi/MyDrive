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
  // Track the current user to detect changes
  const currentUserRef = useRef(localStorage.getItem("user"));

  // Load lastFolderId from localStorage on init
  const [currentFolderId, setCurrentFolderId] = useState(() => {
    const saved = localStorage.getItem("lastFolderId");
    return saved || "root";
  });
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [driveType, setDriveType] = useState("drive"); // "drive", "shared", "trash"
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
        const savedFolderId = localStorage.getItem("lastFolderId");
        setCurrentFolderId(savedFolderId || "root");
        resetState();
      }
    };

    // Check on mount and interval
    checkUserChange();
    const interval = setInterval(checkUserChange, 100);

    return () => clearInterval(interval);
  }, [resetState]);

  const updateCurrentFolder = useCallback((folderId) => {
    logger.info("DriveContext: Navigating to folder", { folderId });
    setCurrentFolderId((prevId) => {
      localStorage.setItem("lastFolderId", folderId);
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
  }, []);

  const updateDriveType = useCallback(
    (type) => {
      logger.info("DriveContext: Changing drive type", { driveType: type });
      setDriveType(type);
      resetState();
    },
    [resetState]
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
      prev.map((f) => (f._id === fileId ? { ...f, ...updatedData } : f))
    );
  }, []);

  const updateFolder = useCallback((folderId, updatedData) => {
    setFolders((prev) =>
      prev.map((f) => (f._id === folderId ? { ...f, ...updatedData } : f))
    );
  }, []);

  const value = {
    currentFolderId,
    folders,
    files,
    loading,
    loadingMore,
    currentPage,
    hasMore,
    driveType,
    reloadTrigger,
    setFolders,
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
