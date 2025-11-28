import { useState, useEffect, useRef } from "react";
import { useDriveContext } from "../contexts/DriveContext";

const generateInitialPath = (type) => {
  const baseName =
    type === "shared"
      ? "Shared with me"
      : type === "trash"
      ? "Trash"
      : "My Drive";

  return [{ id: "root", name: baseName }];
};

export const useBreadcrumbs = (type) => {
  const { currentFolderId, updateCurrentFolder } = useDriveContext();
  const [path, setPath] = useState(generateInitialPath(type));
  const breadcrumbRef = useRef(null);

  // Reset path when type changes
  useEffect(() => {
    setPath(generateInitialPath(type));
    updateCurrentFolder("root");
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
