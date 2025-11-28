/**
 * Generate breadcrumb navigation based on type
 */
export const generateInitialPath = (type) => {
  const pathNames = {
    shared: "Shared with me",
    trash: "Trash",
    drive: "My Drive",
  };

  return [{ id: "root", name: pathNames[type] || "My Drive" }];
};

/**
 * Download file utility
 */
export const downloadFile = async (api, fileId, fileName) => {
  try {
    const response = await api.downloadFile(fileId);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    throw new Error("Download failed");
  }
};

/**
 * Scroll element to position
 */
export const scrollToEnd = (element) => {
  if (element) {
    element.scrollTo({
      left: element.scrollWidth,
      behavior: "smooth",
    });
  }
};
