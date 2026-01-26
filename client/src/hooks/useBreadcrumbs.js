import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDriveContext } from "../contexts/DriveContext";
import api from "../services/api";
import logger from "../utils/logger";

const generateInitialPath = (type) => {
  const baseName =
    type === "shared"
      ? "Shared with me"
      : type === "trash"
      ? "Trash"
      : "My Drive";

  return [{ id: "root", name: baseName }];
};

// Build breadcrumb path by traversing up the folder hierarchy
const buildPathFromFolder = async (folderId, type) => {
  if (folderId === "root") {
    return generateInitialPath(type);
  }

  try {
    const response = await api.getFolderDetails(folderId);
    const folder = response.data;
    const path = [{ id: folder._id, name: folder.name }];

    // Traverse up to build the full path
    let currentFolder = folder;
    while (currentFolder.parent) {
      const parentResponse = await api.getFolderDetails(currentFolder.parent);
      currentFolder = parentResponse.data;
      path.unshift({ id: currentFolder._id, name: currentFolder.name });
    }

    // Add root at the beginning
    path.unshift(generateInitialPath(type)[0]);
    return path;
  } catch (error) {
    logger.logError(error, "Failed to build folder path", { folderId, type });
    // Return root path as fallback
    return generateInitialPath(type);
  }
};

export const useBreadcrumbs = (type, customNavigate = null) => {
  const { currentFolderId, updateCurrentFolder, driveType } = useDriveContext();
  const defaultNavigate = useNavigate();
  const navigate = customNavigate || defaultNavigate;
  const [path, setPath] = useState(() => generateInitialPath(type));
  const breadcrumbRef = useRef(null);
  const previousTypeRef = useRef(type);
  const previousFolderIdRef = useRef(null); // Start with null to force initial build
  const isInitializedRef = useRef(false);
  const skipBuildForFolderRef = useRef(null); // Track which folder ID to skip building for
  const isBuildingRef = useRef(false); // Prevent concurrent builds

  // Reset path when type changes
  useEffect(() => {
    if (previousTypeRef.current !== type) {
      logger.debug("Type changed, resetting breadcrumb", {
        oldType: previousTypeRef.current,
        newType: type,
      });
      const newPath = generateInitialPath(type);
      setPath(newPath);
      previousTypeRef.current = type;
      // Reset folder tracking to prevent stale folder paths
      previousFolderIdRef.current = null;
      isInitializedRef.current = false;
    }
  }, [type]);

  // Build path from currentFolderId on mount and whenever it changes
  useEffect(() => {
    // Check if we're within the navigation lock period (prevent race conditions)
    // skipBuildForFolderRef stores either a folder ID or a timestamp when navigation started
    const skipValue = skipBuildForFolderRef.current;
    
    // If skipValue is a number (timestamp), check if we're still within lock period (500ms)
    if (typeof skipValue === 'number') {
      const timeSinceNavigation = Date.now() - skipValue;
      if (timeSinceNavigation < 500) {
        previousFolderIdRef.current = currentFolderId;
        isInitializedRef.current = true;
        return;
      } else {
        // Lock expired, clear it
        skipBuildForFolderRef.current = null;
      }
    }
    
    // Legacy: Handle folder ID skip flag (for compatibility)
    if (skipValue === currentFolderId) {
      previousFolderIdRef.current = currentFolderId;
      isInitializedRef.current = true;
      skipBuildForFolderRef.current = null;
      return;
    }
    
    // Clear the skip flag if we're now on a different folder
    if (skipValue !== null && skipValue !== currentFolderId) {
      skipBuildForFolderRef.current = null;
    }
    
    // Skip if type is not synchronized with context (during view transitions)
    if (driveType !== type) {
      return;
    }
    
    // Build path on first render or when folder actually changed
    const shouldBuild = !isInitializedRef.current || previousFolderIdRef.current !== currentFolderId;
    
    if (shouldBuild) {
      // Prevent building if we're already in the process of building for this folder
      if (isBuildingRef.current) {
        return;
      }
      
      const folderIdForBuild = currentFolderId;
      previousFolderIdRef.current = currentFolderId;
      isInitializedRef.current = true;
      
      if (currentFolderId === "root") {
        setPath(generateInitialPath(type));
      } else {
        isBuildingRef.current = true;
        buildPathFromFolder(currentFolderId, type).then((newPath) => {
          isBuildingRef.current = false;
          // Only set path if we're still on the same folder (avoid stale updates)
          if (previousFolderIdRef.current === folderIdForBuild) {
            setPath(newPath);
          }
        }).catch(() => {
          isBuildingRef.current = false;
        });
      }
    }
  }, [currentFolderId, type, driveType]);

  // Update document title based on location
  useEffect(() => {
    const locationName = path[path.length - 1]?.name || "My Drive";
    document.title = locationName;
  }, [path]);

  // Auto-scroll breadcrumbs to the end when path changes
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollTo({
        left: breadcrumbRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
  }, [path]);

  const navigateTo = (index) => {
    const newPath = path.slice(0, index + 1);
    const newFolderId = newPath[newPath.length - 1].id;
    
    // Optimistically update path for immediate feedback
    setPath(newPath);
    
    // Set timestamp lock to prevent path rebuild when context updates
    skipBuildForFolderRef.current = Date.now();
    previousFolderIdRef.current = newFolderId;

    // Update URL - this will trigger DriveView's effect to update the context
    // We do NOT call updateCurrentFolder() here to avoid double-loading
    if (newFolderId === "root") {
      navigate(`/${type}`, { replace: false });
    } else {
      navigate(`/${type}/${newFolderId}`, { replace: false });
    }
  };

  const openFolder = (folder) => {
    // Set timestamp lock to prevent race conditions
    skipBuildForFolderRef.current = Date.now();
    previousFolderIdRef.current = folder._id;
    
    setPath([...path, { id: folder._id, name: folder.name }]);
    updateCurrentFolder(folder._id);
  };

  return {
    path,
    currentFolderId,
    breadcrumbRef,
    navigateTo,
    openFolder,
    setPath,
  };
};
