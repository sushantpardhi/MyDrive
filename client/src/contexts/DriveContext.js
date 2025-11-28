import { createContext, useContext, useState, useCallback } from "react";

const DriveContext = createContext();

export const useDriveContext = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error("useDriveContext must be used within a DriveProvider");
  }
  return context;
};

export const DriveProvider = ({ children }) => {
  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [driveType, setDriveType] = useState("drive"); // "drive", "shared", "trash"

  const resetState = useCallback(() => {
    setFolders([]);
    setFiles([]);
    setCurrentPage(1);
    setHasMore(true);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  const updateCurrentFolder = useCallback(
    (folderId) => {
      setCurrentFolderId(folderId);
      resetState();
    },
    [resetState]
  );

  const updateDriveType = useCallback(
    (type) => {
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
