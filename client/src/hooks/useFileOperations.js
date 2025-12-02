import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import { downloadFile } from "../utils/helpers";
import { useDriveContext } from "../contexts/DriveContext";
import { useUIContext } from "../contexts";
import {
  createChunkedUploadService,
  CHUNK_SIZE,
} from "../services/chunkedUpload";
import logger from "../utils/logger";

export const useFileOperations = (
  api,
  loadFolderContents,
  uploadProgressHook = null,
  downloadProgressHook = null
) => {
  const { currentFolderId } = useDriveContext();
  const { refreshStorage } = useUIContext();
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const createFolder = useCallback(async () => {
    const name = prompt("Enter new folder name:");
    if (!name?.trim()) return null;

    try {
      logger.logFileOperation("create_folder", name, {
        parentId: currentFolderId,
      });
      const response = await api.createFolder(name, currentFolderId);
      toast.success("Folder created successfully");
      logger.info("Folder created successfully", {
        folderName: name,
        folderId: response.data._id,
      });
      return response.data;
    } catch (error) {
      toast.error("Failed to create folder");
      logger.logError(error, "Failed to create folder", { folderName: name });
      return null;
    }
  }, [api, currentFolderId]);

  const uploadFiles = useCallback(
    async (files, onSuccess, useChunked = true) => {
      if (!files?.length) return;

      logger.info("Starting file upload", {
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        useChunked,
      });

      setUploadLoading(true);
      const uploadedFiles = [];
      const failedFiles = [];

      try {
        // Determine which files should use chunked upload (files > 5MB)
        const chunkedThreshold = 5 * 1024 * 1024; // 5MB

        // Start uploads for all files
        const uploadPromises = files.map(async (file) => {
          const fileId = `${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          const shouldUseChunked = useChunked && file.size > chunkedThreshold;
          const totalChunks = shouldUseChunked
            ? Math.ceil(file.size / CHUNK_SIZE)
            : 0;

          if (uploadProgressHook) {
            uploadProgressHook.startUpload(
              fileId,
              file.name,
              file.size,
              shouldUseChunked,
              totalChunks
            );
          }

          try {
            let response;

            if (shouldUseChunked) {
              // Use chunked upload service
              const chunkService = createChunkedUploadService(
                api,
                // Overall progress callback
                (
                  uploadFileId,
                  uploadedBytes,
                  totalBytes,
                  uploadedChunks,
                  totalChunksCount
                ) => {
                  if (uploadProgressHook) {
                    uploadProgressHook.updateProgress(
                      uploadFileId,
                      uploadedBytes,
                      totalBytes,
                      uploadedChunks,
                      totalChunksCount
                    );
                  }
                },
                // Chunk progress callback
                (uploadFileId, chunkIndex, chunkStatus, retryAttempt) => {
                  if (uploadProgressHook) {
                    uploadProgressHook.updateChunkProgress(
                      uploadFileId,
                      chunkIndex,
                      chunkStatus,
                      retryAttempt
                    );
                  }
                }
              );

              // Register chunk service for pause/resume/cancel operations
              if (
                uploadProgressHook &&
                uploadProgressHook.registerChunkService
              ) {
                uploadProgressHook.registerChunkService(fileId, chunkService);
              }

              const result = await chunkService.uploadFile(
                file,
                currentFolderId,
                fileId
              );

              // Check if upload was paused
              if (result.paused) {
                // Don't complete or unregister - upload is paused and can be resumed
                logger.info("Upload paused", { fileName: file.name });
                return null; // Return null to indicate paused, not failed
              }

              if (uploadProgressHook) {
                uploadProgressHook.completeUpload(
                  fileId,
                  true,
                  result.uploadStats
                );
                // Unregister chunk service after upload completes
                if (uploadProgressHook.unregisterChunkService) {
                  uploadProgressHook.unregisterChunkService(fileId);
                }
              }

              // Extract the file data from the server response
              const fileData = result.fileData?.file || result.fileData;

              if (!fileData || !fileData.name) {
                logger.error("Invalid file data received from chunked upload", {
                  result,
                });
                throw new Error("Invalid file data received from server");
              }

              response = { data: fileData };
            } else {
              // Use regular upload for smaller files
              response = await api.uploadFile(
                file,
                currentFolderId,
                uploadProgressHook
                  ? (loaded) => {
                      uploadProgressHook.updateProgress(fileId, loaded);
                    }
                  : null
              );

              if (uploadProgressHook) {
                uploadProgressHook.completeUpload(fileId, true);
              }
            }

            return response.data;
          } catch (error) {
            // Check if error is from paused upload
            const isPausedError = error.message === "Upload paused by user";

            if (uploadProgressHook) {
              // Don't mark as failed if paused
              if (!isPausedError) {
                uploadProgressHook.completeUpload(fileId, false);
              }
              // Unregister chunk service on error too (but not on pause)
              if (!isPausedError && uploadProgressHook.unregisterChunkService) {
                uploadProgressHook.unregisterChunkService(fileId);
              }
            }

            // Don't add to failed files if paused
            if (!isPausedError) {
              failedFiles.push(file.name);
              logger.logError(error, `Failed to upload file`, {
                fileName: file.name,
                shouldUseChunked,
              });

              // Show specific error message for chunked uploads
              if (shouldUseChunked) {
                toast.error(
                  `Chunked upload failed for ${file.name}: ${error.message}`
                );
              }
            }

            return null;
          }
        });

        const results = await Promise.allSettled(uploadPromises);

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            uploadedFiles.push(result.value);
          }
        });

        // Show appropriate success/error messages
        if (uploadedFiles.length > 0 && failedFiles.length === 0) {
          toast.success(
            `${uploadedFiles.length} file${
              uploadedFiles.length > 1 ? "s" : ""
            } uploaded successfully`
          );
        } else if (uploadedFiles.length > 0 && failedFiles.length > 0) {
          toast.success(
            `${uploadedFiles.length} file${
              uploadedFiles.length > 1 ? "s" : ""
            } uploaded successfully`
          );
          toast.error(`Failed to upload: ${failedFiles.join(", ")}`);
        } else if (failedFiles.length > 0) {
          toast.error("All file uploads failed");
        }

        if (onSuccess && uploadedFiles.length > 0) {
          onSuccess(uploadedFiles);
        }

        return uploadedFiles;
      } catch (error) {
        toast.error("File upload failed");
        logger.logError(error, "File upload failed");
        return [];
      } finally {
        setUploadLoading(false);
      }
    },
    [api, currentFolderId, uploadProgressHook]
  );

  const deleteItem = useCallback(
    async (id, itemType, isPermanent = false, passwordVerifyFn = null) => {
      const confirmMessage = isPermanent
        ? "Are you sure you want to permanently delete this item? This cannot be undone."
        : "Are you sure you want to move this item to trash?";

      if (!isPermanent) {
        // For non-permanent deletion (move to trash), use normal confirmation
        if (!window.confirm(confirmMessage)) return false;
      } else {
        // For permanent deletion, password verification is required
        if (!passwordVerifyFn) {
          toast.error(
            "Password verification is required for permanent deletion"
          );
          logger.error(
            "deleteItem called with isPermanent=true but no passwordVerifyFn provided"
          );
          return false;
        }

        try {
          // The passwordVerifyFn should handle showing the modal and return a promise
          await passwordVerifyFn(confirmMessage);
        } catch (error) {
          // User cancelled or password verification failed
          logger.info("Password verification cancelled or failed", {
            itemId: id,
            itemType,
          });
          return false;
        }
      }

      setDeleteLoading(true);
      try {
        if (isPermanent) {
          await api.deleteItemPermanently(itemType, id);
        } else {
          await api.moveToTrash(itemType, id);
        }

        // Reload folder contents to sync with backend
        await loadFolderContents(currentFolderId, 1, false);

        // Refresh storage display if item was permanently deleted
        if (isPermanent) {
          logger.info("Refreshing storage after permanent deletion", {
            itemId: id,
            itemType,
          });
          refreshStorage();
        }

        toast.success(
          isPermanent ? "Item permanently deleted" : "Item moved to trash"
        );
        return true;
      } catch (error) {
        const errorMsg =
          error.response?.data?.error ||
          (isPermanent
            ? "Permanent deletion failed"
            : "Moving to trash failed");
        toast.error(errorMsg);
        console.error(error);
        return false;
      } finally {
        setDeleteLoading(false);
      }
    },
    [api, loadFolderContents, currentFolderId, refreshStorage]
  );

  const handleDownload = useCallback(
    async (fileId, fileName) => {
      try {
        await downloadFile(api, fileId, fileName);
      } catch (error) {
        toast.error("Download failed");
        console.error(error);
      }
    },
    [api]
  );

  const handleFolderDownload = useCallback(
    async (folderId, folderName) => {
      const downloadId = `download-${Date.now()}-${folderId}`;

      try {
        // First, get folder info to determine total files
        let totalFiles = 1;
        let totalSize = 0;

        // Use XMLHttpRequest for progress tracking
        const token = localStorage.getItem("token");
        const API_URL =
          process.env.REACT_APP_API_URL ||
          `http://${window.location.hostname}:8080/api`;

        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
          xhr.open("GET", `${API_URL}/folders/download/${folderId}`, true);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.responseType = "blob";

          // Start download progress tracking
          if (downloadProgressHook) {
            downloadProgressHook.startDownload(
              downloadId,
              `${folderName}.zip`,
              0,
              totalFiles
            );
          }

          toast.info("Preparing folder for download...");

          // Get total size and files from headers when they arrive
          xhr.onreadystatechange = () => {
            if (xhr.readyState === xhr.HEADERS_RECEIVED) {
              const filesHeader = xhr.getResponseHeader("X-Total-Files");
              const sizeHeader = xhr.getResponseHeader("X-Total-Size");

              if (filesHeader) totalFiles = parseInt(filesHeader);
              if (sizeHeader) totalSize = parseInt(sizeHeader);

              // Update with actual file count and size
              if (downloadProgressHook) {
                downloadProgressHook.startDownload(
                  downloadId,
                  `${folderName}.zip`,
                  totalSize,
                  totalFiles
                );
              }

              toast.info(
                `Zipping ${totalFiles} file${totalFiles !== 1 ? "s" : ""}...`
              );
            }
          };

          let lastLoaded = 0;
          let lastTime = Date.now();

          // Track download progress
          xhr.onprogress = (event) => {
            if (downloadProgressHook) {
              if (event.lengthComputable) {
                // Calculate speed
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                const bytesDiff = event.loaded - lastLoaded;
                const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

                lastLoaded = event.loaded;
                lastTime = now;

                downloadProgressHook.updateProgress(
                  downloadId,
                  event.loaded,
                  event.total,
                  speed
                );
              } else {
                // If content-length not available, show indeterminate progress
                downloadProgressHook.updateProgress(
                  downloadId,
                  event.loaded,
                  null,
                  0
                );
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const blob = xhr.response;
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", `${folderName}.zip`);
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(url);

              if (downloadProgressHook) {
                downloadProgressHook.completeDownload(downloadId, true);
              }

              toast.success(
                `${folderName}.zip downloaded successfully (${totalFiles} file${
                  totalFiles !== 1 ? "s" : ""
                })`
              );
              resolve();
            } else {
              const errorMsg = xhr.statusText || "Download failed";

              if (downloadProgressHook) {
                downloadProgressHook.completeDownload(downloadId, false);
              }

              toast.error(errorMsg);
              reject(new Error(errorMsg));
            }
          };

          xhr.onerror = () => {
            if (downloadProgressHook) {
              downloadProgressHook.completeDownload(downloadId, false);
            }

            toast.error("Download failed");
            reject(new Error("Download failed"));
          };

          xhr.onabort = () => {
            if (downloadProgressHook) {
              downloadProgressHook.cancelDownload(downloadId);
            }

            toast.info("Download cancelled");
            reject(new Error("Download cancelled"));
          };

          xhr.send();
        });
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Download failed";

        if (downloadProgressHook) {
          downloadProgressHook.completeDownload(downloadId, false);
        }

        toast.error(errorMsg);
        console.error(error);
      }
    },
    [api, downloadProgressHook]
  );

  const restoreItem = useCallback(
    async (id, itemType) => {
      try {
        await api.restoreFromTrash(itemType, id);
        toast.success("Item restored successfully");
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Restore failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [api]
  );

  const emptyTrash = useCallback(
    async (passwordVerifyFn = null) => {
      const confirmMessage =
        "Are you sure you want to permanently delete all items in trash? This cannot be undone.";

      // Password verification is required for emptying trash
      if (!passwordVerifyFn) {
        toast.error("Password verification is required for permanent deletion");
        logger.error("emptyTrash called without passwordVerifyFn");
        return false;
      }

      try {
        // The passwordVerifyFn should handle showing the modal and return a promise
        await passwordVerifyFn(confirmMessage);
      } catch (error) {
        // User cancelled or password verification failed
        logger.info("Password verification cancelled or failed for emptyTrash");
        return false;
      }

      try {
        await api.emptyTrash();
        logger.info("Refreshing storage after emptying trash");
        refreshStorage();
        toast.success("Trash emptied successfully");
        return true;
      } catch (error) {
        toast.error("Failed to empty trash");
        console.error(error);
        return false;
      }
    },
    [api, refreshStorage]
  );

  const renameItem = useCallback(
    async (id, name, itemType) => {
      try {
        if (itemType === "folders") {
          await api.renameFolder(id, name);
        } else {
          await api.renameFile(id, name);
        }
        toast.success(
          `${itemType === "folders" ? "Folder" : "File"} renamed successfully`
        );
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Rename failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [api]
  );

  const copyItem = useCallback(
    async (id, parent, itemType, name = null) => {
      try {
        let response;
        if (itemType === "folders") {
          response = await api.copyFolder(id, parent, name);
        } else {
          response = await api.copyFile(id, parent, name);
        }
        toast.success(
          `${itemType === "folders" ? "Folder" : "File"} copied successfully`
        );
        return response.data.item;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Copy failed";
        toast.error(errorMsg);
        console.error(error);
        return null;
      }
    },
    [api]
  );

  const moveItem = useCallback(
    async (id, parent, itemType) => {
      try {
        if (itemType === "folders") {
          await api.moveFolder(id, parent);
        } else {
          await api.moveFile(id, parent);
        }
        toast.success(
          `${itemType === "folders" ? "Folder" : "File"} moved successfully`
        );
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Move failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [api]
  );

  // Cancel chunked upload
  const cancelChunkedUpload = useCallback(
    async (uploadId, fileId) => {
      try {
        await api.cancelChunkedUpload(uploadId);

        if (uploadProgressHook) {
          uploadProgressHook.cancelUpload(fileId);
        }

        toast.success("Upload cancelled successfully");
        return true;
      } catch (error) {
        console.error("Failed to cancel upload:", error);
        toast.error("Failed to cancel upload");
        return false;
      }
    },
    [api, uploadProgressHook]
  );

  // Get active upload sessions
  const getActiveUploads = useCallback(async () => {
    try {
      const response = await api.getActiveUploadSessions();
      return response.data.sessions;
    } catch (error) {
      console.error("Failed to get active uploads:", error);
      return [];
    }
  }, [api]);

  // Resume a chunked upload
  const resumeChunkedUpload = useCallback(
    async (uploadId, file) => {
      try {
        const statusResponse = await api.getUploadStatus(uploadId);
        const session = statusResponse.data;

        const fileId = `resume-${uploadId}`;

        if (uploadProgressHook) {
          uploadProgressHook.startUpload(
            fileId,
            session.fileName,
            session.fileSize,
            true,
            session.totalChunks
          );

          // Update progress with current status
          uploadProgressHook.updateProgress(
            fileId,
            session.uploadedBytes,
            session.fileSize,
            session.uploadedChunks.length,
            session.totalChunks
          );
        }

        // Create chunked upload service and resume
        const chunkService = createChunkedUploadService(
          api,
          (
            uploadFileId,
            uploadedBytes,
            totalBytes,
            uploadedChunks,
            totalChunksCount
          ) => {
            if (uploadProgressHook) {
              uploadProgressHook.updateProgress(
                uploadFileId,
                uploadedBytes,
                totalBytes,
                uploadedChunks,
                totalChunksCount
              );
            }
          },
          (uploadFileId, chunkIndex, chunkStatus, retryAttempt) => {
            if (uploadProgressHook) {
              uploadProgressHook.updateChunkProgress(
                uploadFileId,
                chunkIndex,
                chunkStatus,
                retryAttempt
              );
            }
          }
        );

        const result = await chunkService.resumeUpload(uploadId, file, fileId);

        if (uploadProgressHook) {
          uploadProgressHook.completeUpload(fileId, true, result.uploadStats);
        }

        toast.success("Upload resumed and completed successfully");
        return result;
      } catch (error) {
        console.error("Failed to resume upload:", error);
        toast.error("Failed to resume upload");
        return null;
      }
    },
    [api, uploadProgressHook]
  );

  return {
    createFolder,
    uploadFiles,
    deleteItem,
    handleDownload,
    handleFolderDownload,
    restoreItem,
    emptyTrash,
    renameItem,
    copyItem,
    moveItem,
    cancelChunkedUpload,
    getActiveUploads,
    resumeChunkedUpload,
    uploadLoading,
    deleteLoading,
  };
};
