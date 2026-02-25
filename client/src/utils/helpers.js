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
 * Download file utility with progress tracking
 */
export const downloadFile = async (api, fileId, fileName, progressCallback) => {
  return new Promise(async (resolve, reject) => {
    try {
      // First verify download permissions (this is fast)
      const verifyResponse = await api.verifyFileDownload(fileId);

      if (!verifyResponse.data.verified) {
        throw new Error("Download verification failed");
      }

      const fileSize = verifyResponse.data.size;

      // Now initiate the actual download with progress tracking
      const token = localStorage.getItem("token");
      const API_URL = process.env.REACT_APP_API_URL;

      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${API_URL}/files/download/${fileId}`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.responseType = "blob";

      // Register XHR for cancellation if callback provided
      if (progressCallback && progressCallback.onRegisterXhr) {
        progressCallback.onRegisterXhr(xhr);
      }

      let lastLoaded = 0;
      let lastTime = Date.now();

      // Track download progress
      xhr.onprogress = (event) => {
        if (progressCallback) {
          if (event.lengthComputable) {
            // Calculate speed
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            const bytesDiff = event.loaded - lastLoaded;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastLoaded = event.loaded;
            lastTime = now;

            progressCallback.onProgress(
              event.loaded,
              event.total || fileSize,
              speed,
            );
          } else {
            progressCallback.onProgress(event.loaded, fileSize, 0);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          if (progressCallback) {
            progressCallback.onComplete(true);
          }

          resolve();
        } else {
          const errorMsg = xhr.statusText || "Download failed";

          if (progressCallback) {
            progressCallback.onComplete(false);
          }

          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        if (progressCallback) {
          progressCallback.onComplete(false);
        }

        reject(new Error("Download failed"));
      };

      xhr.onabort = () => {
        if (progressCallback) {
          progressCallback.onCancel();
        }

        // Resolve instead of reject to avoid error overlays
        resolve({ cancelled: true });
      };

      xhr.send();
    } catch (error) {
      reject(error);
    }
  });
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

/**
 * Download multiple files/folders as ZIP with progress tracking
 * @param {object} api - API service
 * @param {Array<string>} fileIds - Array of file IDs
 * @param {Array<string>} folderIds - Array of folder IDs
 * @param {string} downloadName - Name for the downloaded ZIP file
 * @param {object} progressCallbacks - Progress callback functions
 */
export const downloadMultiple = async (
  api,
  fileIds = [],
  folderIds = [],
  downloadName = "download.zip",
  progressCallbacks = {},
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { onZipping, onProgress, onComplete, onCancel } = progressCallbacks;

      const token = localStorage.getItem("token");
      const API_URL = process.env.REACT_APP_API_URL;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/files/download`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.responseType = "blob";
      xhr.timeout = 30 * 60 * 1000; // 30 minutes

      let lastLoaded = 0;
      let lastTime = Date.now();

      // Initial zipping phase
      if (onZipping) {
        onZipping(0, fileIds.length + folderIds.length);
      }

      // Track download progress
      xhr.onprogress = (event) => {
        if (onProgress) {
          if (event.lengthComputable) {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            const bytesDiff = event.loaded - lastLoaded;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastLoaded = event.loaded;
            lastTime = now;

            onProgress(event.loaded, event.total, speed);
          } else {
            onProgress(event.loaded, 0, 0);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", downloadName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          if (onComplete) {
            onComplete(true);
          }

          resolve();
        } else {
          const errorMsg = xhr.statusText || "Download failed";

          if (onComplete) {
            onComplete(false);
          }

          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        if (onComplete) {
          onComplete(false);
        }

        reject(new Error("Download failed"));
      };

      xhr.onabort = () => {
        if (onCancel) {
          onCancel();
        }

        // Resolve instead of reject to avoid error overlays
        resolve({ cancelled: true });
      };

      xhr.ontimeout = () => {
        if (onComplete) {
          onComplete(false);
        }

        reject(new Error("Download timed out"));
      };

      // Send request
      xhr.send(JSON.stringify({ files: fileIds, folders: folderIds }));
    } catch (error) {
      reject(error);
    }
  });
};
