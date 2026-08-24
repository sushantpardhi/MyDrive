/**
 * IndexedDB utility for persisting upload/download progress
 * Allows resuming uploads even after browser crash or refresh
 */

const DB_NAME = "MyDriveStorage";
const DB_VERSION = 1;
const UPLOADS_STORE = "uploadProgress";
const DOWNLOADS_STORE = "downloadProgress";

let db = null;

/**
 * Initialize IndexedDB connection
 */
export const initializeDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create upload progress store
      if (!database.objectStoreNames.contains(UPLOADS_STORE)) {
        database.createObjectStore(UPLOADS_STORE, { keyPath: "uploadId" });
      }

      // Create download progress store
      if (!database.objectStoreNames.contains(DOWNLOADS_STORE)) {
        database.createObjectStore(DOWNLOADS_STORE, { keyPath: "downloadId" });
      }
    };
  });
};

/**
 * Save upload progress to IndexedDB
 * @param {string} uploadId - Unique upload identifier
 * @param {Object} progress - Upload progress data
 * @returns {Promise<void>}
 */
export const saveUploadProgress = async (uploadId, progress) => {
  const database = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([UPLOADS_STORE], "readwrite");
    const store = transaction.objectStore(UPLOADS_STORE);

    const data = {
      uploadId,
      fileName: progress.fileName,
      fileSize: progress.fileSize,
      uploadedBytes: progress.uploadedBytes,
      uploadedChunks: progress.uploadedChunks || [],
      totalChunks: progress.totalChunks,
      chunkSize: progress.chunkSize,
      parentFolder: progress.parentFolder,
      startTime: progress.startTime,
      lastUpdated: Date.now(),
      status: progress.status || "uploading",
    };

    const request = store.put(data);

    request.onerror = () => {
      console.error("Error saving upload progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

/**
 * Get upload progress from IndexedDB
 * @param {string} uploadId - Unique upload identifier
 * @returns {Promise<Object|null>}
 */
export const getUploadProgress = async (uploadId) => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([UPLOADS_STORE], "readonly");
    const store = transaction.objectStore(UPLOADS_STORE);
    const request = store.get(uploadId);

    request.onerror = () => {
      console.error("Error retrieving upload progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
};

/**
 * Delete upload progress from IndexedDB
 * @param {string} uploadId - Unique upload identifier
 * @returns {Promise<void>}
 */
export const deleteUploadProgress = async (uploadId) => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([UPLOADS_STORE], "readwrite");
    const store = transaction.objectStore(UPLOADS_STORE);
    const request = store.delete(uploadId);

    request.onerror = () => {
      console.error("Error deleting upload progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

/**
 * Get all incomplete uploads
 * @returns {Promise<Array>}
 */
export const getAllIncompleteUploads = async () => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([UPLOADS_STORE], "readonly");
    const store = transaction.objectStore(UPLOADS_STORE);
    const request = store.getAll();

    request.onerror = () => {
      console.error("Error retrieving uploads:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const uploads = request.result || [];
      // Filter to incomplete uploads only
      resolve(uploads.filter(u => u.status !== "completed" && u.status !== "failed"));
    };
  });
};

/**
 * Save download progress to IndexedDB
 * @param {string} downloadId - Unique download identifier
 * @param {Object} progress - Download progress data
 * @returns {Promise<void>}
 */
export const saveDownloadProgress = async (downloadId, progress) => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DOWNLOADS_STORE], "readwrite");
    const store = transaction.objectStore(DOWNLOADS_STORE);

    const data = {
      downloadId,
      fileId: progress.fileId,
      fileName: progress.fileName,
      fileSize: progress.fileSize,
      downloadedBytes: progress.downloadedBytes,
      downloadedChunks: progress.downloadedChunks || [],
      totalChunks: progress.totalChunks,
      chunkSize: progress.chunkSize,
      startTime: progress.startTime,
      lastUpdated: Date.now(),
      status: progress.status || "downloading",
    };

    const request = store.put(data);

    request.onerror = () => {
      console.error("Error saving download progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

/**
 * Get download progress from IndexedDB
 * @param {string} downloadId - Unique download identifier
 * @returns {Promise<Object|null>}
 */
export const getDownloadProgress = async (downloadId) => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DOWNLOADS_STORE], "readonly");
    const store = transaction.objectStore(DOWNLOADS_STORE);
    const request = store.get(downloadId);

    request.onerror = () => {
      console.error("Error retrieving download progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
};

/**
 * Delete download progress from IndexedDB
 * @param {string} downloadId - Unique download identifier
 * @returns {Promise<void>}
 */
export const deleteDownloadProgress = async (downloadId) => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DOWNLOADS_STORE], "readwrite");
    const store = transaction.objectStore(DOWNLOADS_STORE);
    const request = store.delete(downloadId);

    request.onerror = () => {
      console.error("Error deleting download progress:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

/**
 * Clear all stored progress (for privacy/cleanup)
 * @returns {Promise<void>}
 */
export const clearAllProgress = async () => {
  const database = await initializeDB();

  return new Promise((resolve, reject) => {
    const uploadTx = database.transaction([UPLOADS_STORE], "readwrite");
    const uploadStore = uploadTx.objectStore(UPLOADS_STORE);
    const clearUploadRequest = uploadStore.clear();

    const downloadTx = database.transaction([DOWNLOADS_STORE], "readwrite");
    const downloadStore = downloadTx.objectStore(DOWNLOADS_STORE);
    const clearDownloadRequest = downloadStore.clear();

    clearUploadRequest.onerror = () => {
      console.error("Error clearing uploads:", clearUploadRequest.error);
      reject(clearUploadRequest.error);
    };

    clearDownloadRequest.onerror = () => {
      console.error("Error clearing downloads:", clearDownloadRequest.error);
      reject(clearDownloadRequest.error);
    };

    clearDownloadRequest.onsuccess = () => {
      resolve();
    };
  });
};
