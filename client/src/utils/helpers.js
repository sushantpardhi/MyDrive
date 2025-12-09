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

/**
 * Get user initials for avatar placeholder
 * @param {string} name - User's full name
 * @returns {string} - User initials (max 2 characters)
 */
export const getUserInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Generate consistent color for avatar background based on name
 * @param {string} name - User's name
 * @returns {string} - HSL color string
 */
export const getAvatarColor = (name) => {
  if (!name) return "hsl(0, 0%, 70%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};
