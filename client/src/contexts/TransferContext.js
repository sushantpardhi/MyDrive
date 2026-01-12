import { createContext, useContext, useCallback } from "react";
import { useUploadProgress } from "../hooks/useUploadProgress";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import { useUIContext } from "./UIContext";
import logger from "../utils/logger";

const TransferContext = createContext();

export const useTransfer = () => {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error("useTransfer must be used within a TransferProvider");
  }
  return context;
};

export const TransferProvider = ({ children }) => {
  // Get storage refresh function from UIContext
  const { refreshStorage } = useUIContext();

  // Initialize upload and download progress hooks at the app level
  const uploadProgressHook = useUploadProgress();
  const downloadProgressHook = useDownloadProgress();

  logger.debug("TransferProvider initialized", {
    uploadCount: Object.keys(uploadProgressHook.uploadProgress).length,
    downloadCount: Object.keys(downloadProgressHook.downloadProgress).length,
  });

  // Wrap completeUpload to refresh storage on successful upload
  const completeUploadWithRefresh = useCallback(
    (fileId, success = true, uploadStats = null) => {
      // Call original completeUpload
      uploadProgressHook.completeUpload(fileId, success, uploadStats);

      // Refresh storage if upload was successful
      if (success) {
        logger.info("Upload completed successfully, refreshing storage", {
          fileId,
        });
        // Small delay to allow backend to update storage stats
        setTimeout(() => {
          refreshStorage();
        }, 500);
      }
    },
    [uploadProgressHook, refreshStorage]
  );

  // Combined cancelAll that clears both uploads and downloads
  const cancelAll = useCallback(() => {
    uploadProgressHook.cancelAll();
    downloadProgressHook.cancelAll();
  }, [uploadProgressHook, downloadProgressHook]);

  // Combined resetProgress that clears both uploads and downloads
  const resetProgress = useCallback(() => {
    uploadProgressHook.resetProgress();
    downloadProgressHook.resetProgress();
  }, [uploadProgressHook, downloadProgressHook]);

  const value = {
    // Upload methods and state
    uploadProgress: uploadProgressHook.uploadProgress,
    uploading: uploadProgressHook.uploading,
    startUpload: uploadProgressHook.startUpload,
    updateProgress: uploadProgressHook.updateProgress,
    completeUpload: completeUploadWithRefresh, // Use wrapped version that refreshes storage
    failUpload: uploadProgressHook.failUpload,
    cancelUpload: uploadProgressHook.cancelUpload,
    cancelAll: cancelAll, // Use combined cancelAll
    resetProgress: resetProgress, // Use combined resetProgress
    registerChunkService: uploadProgressHook.registerChunkService,
    unregisterChunkService: uploadProgressHook.unregisterChunkService,
    updateChunkProgress: uploadProgressHook.updateChunkProgress,
    completeChunk: uploadProgressHook.completeChunk,
    retryChunk: uploadProgressHook.retryChunk,

    // Download methods and state
    downloadProgress: downloadProgressHook.downloadProgress,
    startDownload: downloadProgressHook.startDownload,
    updateDownloadProgress: downloadProgressHook.updateProgress,
    updateZippingProgress: downloadProgressHook.updateZippingProgress,
    completeDownload: downloadProgressHook.completeDownload,
    failDownload: downloadProgressHook.failDownload,
    cancelDownload: downloadProgressHook.cancelDownload,
    resetDownloadProgress: downloadProgressHook.resetProgress,
  };

  return (
    <TransferContext.Provider value={value}>
      {children}
    </TransferContext.Provider>
  );
};
