import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import { downloadFile } from "../utils/helpers";
import { useDriveContext } from "../contexts/DriveContext";
import { useUIContext } from "../contexts";
import {
  createChunkedUploadService,
  CHUNK_SIZE,
} from "../services/chunkedUpload";
import {
  createChunkedDownloadService,
  CHUNK_SIZE as DOWNLOAD_CHUNK_SIZE,
} from "../services/chunkedDownload";
import logger from "../utils/logger";
import { removeCachedImage } from "../utils/imageCache";

export const useFileOperations = (
  api,
  loadFolderContents,
  uploadProgressHook = null,
  downloadProgressHook = null,
) => {
  const { currentFolderId } = useDriveContext();
  const { refreshStorage } = useUIContext();
  const [uploadLoading, setUploadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const createFolder = useCallback(
    async (name) => {
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
    },
    [api, currentFolderId],
  );

  const uploadFiles = useCallback(
    async (files, onSuccess, useChunked = true, onFileComplete = null) => {
      if (!files?.length) return;

      logger.info("Starting file upload", {
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        useChunked,
      });

      setUploadLoading(true);
      const uploadedFiles = [];
      const failedFiles = [];

      let storageErrorOccurred = false;

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
              totalChunks,
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
                  totalChunksCount,
                ) => {
                  if (uploadProgressHook) {
                    uploadProgressHook.updateProgress(
                      uploadFileId,
                      uploadedBytes,
                      totalBytes,
                      uploadedChunks,
                      totalChunksCount,
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
                      retryAttempt,
                    );
                  }
                },
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
                fileId,
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
                  result.uploadStats,
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
                  : null,
              );

              if (uploadProgressHook) {
                uploadProgressHook.completeUpload(fileId, true);
              }
            }

            const fileData = response.data;

            // Immediately notify about completed file
            if (onFileComplete) {
              onFileComplete(fileData);
            }

            return fileData;
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

              // Check for storage limit error
              const isStorageError =
                error.response?.status === 413 ||
                error.code === "STORAGE_LIMIT_EXCEEDED" ||
                error.message.includes("Storage limit exceeded");

              if (isStorageError) {
                storageErrorOccurred = true;
              }

              // Show specific error message for chunked uploads
              if (shouldUseChunked) {
                if (isStorageError) {
                  // Suppress individual toast if we plan to show a summary one,
                  // or show it here. Let's rely on the summary if multiple fail.
                } else {
                  toast.error(
                    `Chunked upload failed for ${file.name}: ${error.message}`,
                  );
                }
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
        if (storageErrorOccurred) {
          toast.error("Storage is full and cannot upload files");
        } else if (uploadedFiles.length > 0 && failedFiles.length === 0) {
          toast.success(
            `${uploadedFiles.length} file${
              uploadedFiles.length > 1 ? "s" : ""
            } uploaded successfully`,
          );
        } else if (uploadedFiles.length > 0 && failedFiles.length > 0) {
          toast.success(
            `${uploadedFiles.length} file${
              uploadedFiles.length > 1 ? "s" : ""
            } uploaded successfully`,
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
    [api, currentFolderId, uploadProgressHook],
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
            "Password verification is required for permanent deletion",
          );
          logger.error(
            "deleteItem called with isPermanent=true but no passwordVerifyFn provided",
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

          // Clear cached images for permanently deleted files
          if (itemType === "files") {
            await removeCachedImage(id);
            logger.info("Cleared cached images for deleted file", {
              fileId: id,
            });
          }
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
          isPermanent ? "Item permanently deleted" : "Item moved to trash",
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
    [api, loadFolderContents, currentFolderId, refreshStorage],
  );

  const handleDownload = useCallback(
    async (fileId, fileName) => {
      const downloadId = `download-${Date.now()}-${fileId}`;

      try {
        // Verify first to get file size
        const verifyResponse = await api.verifyFileDownload(fileId);
        const fileSize = verifyResponse.data.size;

        // Start download progress tracking
        if (downloadProgressHook) {
          downloadProgressHook.startDownload(downloadId, fileName, fileSize, 1);
        }

        // Show toast notification first
        toast.info("Starting download...");

        // Then download in background with progress tracking
        await downloadFile(api, fileId, fileName, {
          onRegisterXhr: (xhr) => {
            if (downloadProgressHook && downloadProgressHook.registerXhr) {
              downloadProgressHook.registerXhr(downloadId, xhr);
            }
          },
          onProgress: (loaded, total, speed) => {
            if (downloadProgressHook) {
              downloadProgressHook.updateProgress(
                downloadId,
                loaded,
                total,
                speed,
              );
            }
          },
          onComplete: (success) => {
            if (downloadProgressHook) {
              downloadProgressHook.completeDownload(downloadId, success);
              if (downloadProgressHook.unregisterXhr) {
                downloadProgressHook.unregisterXhr(downloadId);
              }
            }
            if (success) {
              toast.success("Download completed");
            }
          },
          onCancel: () => {
            if (downloadProgressHook) {
              downloadProgressHook.cancelDownload(downloadId);
            }
          },
        });
      } catch (error) {
        toast.error("Download failed");
        console.error(error);

        if (downloadProgressHook) {
          downloadProgressHook.completeDownload(downloadId, false);
        }
      }
    },
    [api, downloadProgressHook],
  );

  const handleFolderDownload = useCallback(
    async (folderId, folderName) => {
      const downloadId = `download-${Date.now()}-${folderId}`;

      try {
        // First, verify download and get folder info
        toast.info("Verifying folder access...");

        const verifyResponse = await api.verifyFolderDownload(folderId);
        const { totalFiles, totalSize } = verifyResponse.data;

        // Start download progress tracking immediately after verification
        if (downloadProgressHook) {
          downloadProgressHook.startDownload(
            downloadId,
            `${folderName}.zip`,
            totalSize,
            totalFiles,
          );

          // Show zipping progress initially (preparing phase)
          downloadProgressHook.updateZippingProgress(downloadId, 0, totalFiles);
        }

        // Show initial toast notification
        toast.info(
          `Preparing to download ${totalFiles} file${totalFiles !== 1 ? "s" : ""}...`,
        );

        // Use XMLHttpRequest for progress tracking
        const token = localStorage.getItem("token");
        const API_URL =
          process.env.REACT_APP_API_URL ||
          `http://${window.location.hostname}:8080/api`;

        const xhr = new XMLHttpRequest();
        if (downloadProgressHook && downloadProgressHook.registerXhr) {
          downloadProgressHook.registerXhr(downloadId, xhr);
        }

        return new Promise((resolve, reject) => {
          xhr.open("GET", `${API_URL}/folders/download/${folderId}`, true);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.responseType = "blob";

          let lastLoaded = 0;
          let lastTime = Date.now();
          let isIndeterminate = true;
          let totalBytes = 0;

          // Track download progress
          xhr.onprogress = (event) => {
            if (downloadProgressHook) {
              if (xhr.readyState === 3 && isIndeterminate) {
                // LOADING
                const totalSizeHeader = xhr.getResponseHeader("X-Total-Size");
                if (totalSizeHeader) totalBytes = parseInt(totalSizeHeader);

                // If we have headers, stream started
                // Force switch to downloading state immediately
                downloadProgressHook.updateProgress(
                  downloadId,
                  0,
                  totalBytes,
                  0,
                );
                isIndeterminate = false;
              }

              if (event.lengthComputable || totalBytes > 0) {
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
                  event.total || totalBytes || totalSize,
                  speed,
                );
              } else {
                // If content-length not available, show indeterminate progress
                downloadProgressHook.updateProgress(
                  downloadId,
                  event.loaded,
                  totalSize,
                  0,
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
                })`,
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
            // Resolve instead of reject to avoid error overlays
            resolve({ cancelled: true });
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
    [api, downloadProgressHook],
  );

  const handleBulkDownload = useCallback(
    async (fileIds = [], folderIds = [], zipName = "download.zip") => {
      const downloadId = `bulk-${Date.now()}`;
      const totalCount = fileIds.length + folderIds.length;

      try {
        if (downloadProgressHook) {
          downloadProgressHook.startDownload(
            downloadId,
            zipName,
            0,
            totalCount,
          );
          downloadProgressHook.updateZippingProgress(downloadId, 0, totalCount);
        }

        toast.info(
          `Queuing ${totalCount} item${totalCount !== 1 ? "s" : ""} for zipping...`,
        );

        // 1. Request zip job
        const items = [
          ...fileIds.map((id) => ({ id, type: "file" })),
          ...folderIds.map((id) => ({ id, type: "folder" })),
        ];

        const response = await api.post("/downloads/zip", { items });
        const { jobId } = response.data;

        // 2. Poll for status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await api.get(`/downloads/zip/${jobId}/status`);
            const { status, progress, message } = statusRes.data;

            if (status === "FAILED") {
              clearInterval(pollInterval);
              throw new Error(message || "Zip generation failed");
            }

            if (status === "READY") {
              clearInterval(pollInterval);

              // 3. Initiate Download
              if (downloadProgressHook) {
                downloadProgressHook.updateProgress(downloadId, 0, 0, 0); // Indeterminate
                downloadProgressHook.completeDownload(downloadId, true);
              }

              // Use window location to download file
              // Construct URL with auth token if needed, but cookies usually handle it if same origin
              // If API requires Bearer header, we need to use XHR/fetch to get blob, or use a temporary token in URL
              // Assuming cookie-based auth or that we can pass token in query param if needed.
              // Actually, the existing code used XHR with Bearer token.
              // To download via browser (best for large files without memory issues), we need a way to pass auth.
              // If we use XHR with blob like before:

              const token = localStorage.getItem("token");
              const API_URL =
                process.env.REACT_APP_API_URL ||
                `http://${window.location.hostname}:8080/api`;

              // We'll use the specific Zip download endpoint using XHR to support Auth header
              const xhr = new XMLHttpRequest();
              if (downloadProgressHook && downloadProgressHook.registerXhr) {
                downloadProgressHook.registerXhr(downloadId, xhr);
              }

              xhr.open(
                "GET",
                `${API_URL.replace("/api", "")}/downloads/zip/${jobId}`,
                true,
              );
              xhr.setRequestHeader("Authorization", `Bearer ${token}`);
              xhr.responseType = "blob";

              xhr.onload = () => {
                if (xhr.status === 200) {
                  const blob = xhr.response;
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.setAttribute("download", zipName);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success("Download completed successfully");
                } else {
                  toast.error("Download failed during transfer");
                }
              };
              xhr.send();
            } else {
              // Still processing
              if (downloadProgressHook) {
                // Map numeric progress if available, or just keeping it active
                const numProgress = parseInt(progress) || 0;
                downloadProgressHook.updateZippingProgress(
                  downloadId,
                  numProgress,
                  100,
                );
              }
            }
          } catch (err) {
            clearInterval(pollInterval);
            console.error("Polling error", err);
            toast.error("Error checking zip status");
            if (downloadProgressHook) {
              downloadProgressHook.failDownload(downloadId);
            }
          }
        }, 1000);
      } catch (error) {
        console.error("Bulk download error:", error);
        toast.error("Failed to start download");
        if (downloadProgressHook) {
          downloadProgressHook.failDownload(downloadId);
        }
      }
    },
    [api, downloadProgressHook],
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
    [api],
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
    [api, refreshStorage],
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
          `${itemType === "folders" ? "Folder" : "File"} renamed successfully`,
        );
        return true;
      } catch (error) {
        const errorMsg = error.response?.data?.error || "Rename failed";
        toast.error(errorMsg);
        console.error(error);
        return false;
      }
    },
    [api],
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
          `${itemType === "folders" ? "Folder" : "File"} copied successfully`,
        );
        return response.data.item;
      } catch (error) {
        const isStorageError =
          error.response?.status === 413 ||
          error.code === "STORAGE_LIMIT_EXCEEDED" ||
          error.message?.includes("Storage limit exceeded");

        if (isStorageError) {
          toast.error("Storage is full and cannot copy item");
        } else {
          const errorMsg = error.response?.data?.error || "Copy failed";
          toast.error(errorMsg);
        }
        console.error(error);
        return null;
      }
    },
    [api],
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
          `${itemType === "folders" ? "Folder" : "File"} moved successfully`,
        );
        return true;
      } catch (error) {
        const isStorageError =
          error.response?.status === 413 ||
          error.code === "STORAGE_LIMIT_EXCEEDED" ||
          error.message?.includes("Storage limit exceeded");

        if (isStorageError) {
          toast.error("Storage is full and cannot move item");
        } else {
          const errorMsg = error.response?.data?.error || "Move failed";
          toast.error(errorMsg);
        }
        console.error(error);
        return false;
      }
    },
    [api],
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
    [api, uploadProgressHook],
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
            session.totalChunks,
          );

          // Update progress with current status
          uploadProgressHook.updateProgress(
            fileId,
            session.uploadedBytes,
            session.fileSize,
            session.uploadedChunks.length,
            session.totalChunks,
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
            totalChunksCount,
          ) => {
            if (uploadProgressHook) {
              uploadProgressHook.updateProgress(
                uploadFileId,
                uploadedBytes,
                totalBytes,
                uploadedChunks,
                totalChunksCount,
              );
            }
          },
          (uploadFileId, chunkIndex, chunkStatus, retryAttempt) => {
            if (uploadProgressHook) {
              uploadProgressHook.updateChunkProgress(
                uploadFileId,
                chunkIndex,
                chunkStatus,
                retryAttempt,
              );
            }
          },
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
    [api, uploadProgressHook],
  );

  // Chunked download with pause/resume/cancel support
  const handleChunkedDownload = useCallback(
    async (fileId, fileName, useChunked = true) => {
      const clientDownloadId = `chunked-download-${Date.now()}-${fileId}`;

      try {
        // Verify first to get file size
        const verifyResponse = await api.verifyFileDownload(fileId);
        const fileData = verifyResponse.data;
        const fileSize = fileData.size;

        // Use chunked download for files > 5MB
        const chunkedThreshold = 5 * 1024 * 1024; // 5MB
        const shouldUseChunked = useChunked && fileSize > chunkedThreshold;
        const totalChunks = shouldUseChunked
          ? Math.ceil(fileSize / DOWNLOAD_CHUNK_SIZE)
          : 0;

        // Start download progress tracking
        if (downloadProgressHook) {
          downloadProgressHook.startDownload(
            clientDownloadId,
            fileName || fileData.name,
            fileSize,
            1,
            shouldUseChunked,
            totalChunks,
          );
        }

        if (shouldUseChunked) {
          logger.info("Starting chunked download", {
            fileId,
            fileName,
            fileSize,
            totalChunks,
          });

          // Create chunked download service
          const chunkService = createChunkedDownloadService(
            api,
            // Progress callback
            (
              downloadId,
              downloadedBytes,
              totalBytes,
              downloadedChunks,
              totalChunksCount,
            ) => {
              if (downloadProgressHook) {
                downloadProgressHook.updateProgress(
                  clientDownloadId,
                  downloadedBytes,
                  totalBytes,
                );
              }
            },
            // Chunk progress callback
            (downloadId, chunkIndex, chunkStatus, retryAttempt) => {
              if (
                downloadProgressHook &&
                downloadProgressHook.updateChunkProgress
              ) {
                downloadProgressHook.updateChunkProgress(
                  clientDownloadId,
                  chunkIndex,
                  chunkStatus,
                  retryAttempt,
                );
              }
            },
          );

          // Register chunk service for pause/resume/cancel operations
          if (
            downloadProgressHook &&
            downloadProgressHook.registerChunkService
          ) {
            downloadProgressHook.registerChunkService(
              clientDownloadId,
              chunkService,
            );
          }

          toast.info("Starting chunked download...");

          const result = await chunkService.downloadFile(
            fileId,
            fileName || fileData.name,
            clientDownloadId,
          );

          if (result.paused) {
            logger.info("Chunked download paused", {
              fileId,
              clientDownloadId,
            });
            return { paused: true, downloadId: result.downloadId };
          }

          if (downloadProgressHook) {
            downloadProgressHook.completeDownload(clientDownloadId, true);
            if (downloadProgressHook.unregisterChunkService) {
              downloadProgressHook.unregisterChunkService(clientDownloadId);
            }
          }

          toast.success("Download completed");
          return result;
        } else {
          // Use regular download for smaller files
          toast.info("Starting download...");

          await downloadFile(api, fileId, fileName || fileData.name, {
            onRegisterXhr: (xhr) => {
              if (downloadProgressHook && downloadProgressHook.registerXhr) {
                downloadProgressHook.registerXhr(clientDownloadId, xhr);
              }
            },
            onProgress: (loaded, total, speed) => {
              if (downloadProgressHook) {
                downloadProgressHook.updateProgress(
                  clientDownloadId,
                  loaded,
                  total,
                  speed,
                );
              }
            },
            onComplete: (success) => {
              if (downloadProgressHook) {
                downloadProgressHook.completeDownload(
                  clientDownloadId,
                  success,
                );
                if (downloadProgressHook.unregisterXhr) {
                  downloadProgressHook.unregisterXhr(clientDownloadId);
                }
              }
              if (success) {
                toast.success("Download completed");
              }
            },
            onCancel: () => {
              if (downloadProgressHook) {
                downloadProgressHook.cancelDownload(clientDownloadId);
              }
            },
          });

          return { success: true };
        }
      } catch (error) {
        toast.error(`Download failed: ${error.message}`);
        logger.logError(error, "Chunked download failed", { fileId });

        if (downloadProgressHook) {
          downloadProgressHook.failDownload(clientDownloadId);
          if (downloadProgressHook.unregisterChunkService) {
            downloadProgressHook.unregisterChunkService(clientDownloadId);
          }
        }

        return { success: false, error: error.message };
      }
    },
    [api, downloadProgressHook],
  );

  // Get active download sessions
  const getActiveDownloads = useCallback(async () => {
    try {
      const response = await api.getActiveDownloadSessions();
      return response.data.sessions;
    } catch (error) {
      logger.logError(error, "Failed to get active downloads");
      return [];
    }
  }, [api]);

  // Cancel a chunked download
  const cancelChunkedDownload = useCallback(
    async (downloadId) => {
      try {
        await api.cancelChunkedDownload(downloadId);
        toast.info("Download cancelled");
        return true;
      } catch (error) {
        logger.logError(error, "Failed to cancel download");
        toast.error("Failed to cancel download");
        return false;
      }
    },
    [api],
  );

  const toggleLock = useCallback(
    async (item, itemType) => {
      try {
        const type = itemType === "files" ? "files" : "folders";
        const action = item.isLocked ? "unlock" : "lock";

        if (action === "lock") {
          await api.lockItem(type, item._id);
          toast.success("Item locked successfully");
        } else {
          await api.unlockItem(type, item._id);
          toast.success("Item unlocked successfully");
        }

        return true;
      } catch (error) {
        logger.error("Lock toggle failed", { id: item._id, error });
        toast.error(
          error.response?.data?.error || "Failed to update lock status",
        );
        return false;
      }
    },
    [api],
  );

  return {
    createFolder,
    uploadFiles,
    deleteItem,
    handleDownload,
    handleFolderDownload,
    handleBulkDownload,
    handleChunkedDownload,
    restoreItem,
    emptyTrash,
    renameItem,
    copyItem,
    moveItem,
    cancelChunkedUpload,
    cancelChunkedDownload,
    getActiveUploads,
    getActiveDownloads,
    resumeChunkedUpload,
    toggleLock,
    uploadLoading,
    deleteLoading,
  };
};
