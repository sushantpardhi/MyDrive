import { useState, useEffect, useRef } from "react";
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

export const useBreadcrumbs = (type) => {
  const { currentFolderId, updateCurrentFolder } = useDriveContext();
  const [path, setPath] = useState(generateInitialPath(type));
  const breadcrumbRef = useRef(null);
  const initializedRef = useRef(false);
  const previousTypeRef = useRef(type);
  const pathBuiltRef = useRef(false);

  // Build path from saved lastFolderId on initial mount
  useEffect(() => {
    if (!pathBuiltRef.current && currentFolderId !== "root") {
      pathBuiltRef.current = true;
      buildPathFromFolder(currentFolderId, type).then(setPath);
    }
  }, [currentFolderId, type]);

  // Reset path only when type actually changes (not on initial mount)
  useEffect(() => {
    if (initializedRef.current && previousTypeRef.current !== type) {
      setPath(generateInitialPath(type));
      updateCurrentFolder("root");
      previousTypeRef.current = type;
      pathBuiltRef.current = false;
    } else {
      initializedRef.current = true;
    }
  }, [type, updateCurrentFolder]);

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
    setPath(newPath);
    const newFolderId = newPath[newPath.length - 1].id;
    updateCurrentFolder(newFolderId);

    // Reset pathBuiltRef when navigating to allow rebuilding if needed
    if (newFolderId === "root") {
      pathBuiltRef.current = false;
    }
  };

  const openFolder = (folder) => {
    updateCurrentFolder(folder._id);
    setPath([...path, { id: folder._id, name: folder.name }]);
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
