import { useState, useCallback, useRef } from "react";
import logger from "../utils/logger";

export const useUploadProgress = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const progressDataRef = useRef({});
  const chunkServicesRef = useRef({}); // Store chunk service instances

  const registerChunkService = useCallback((fileId, chunkService) => {
    chunkServicesRef.current[fileId] = chunkService;
  }, []);

  const unregisterChunkService = useCallback((fileId) => {
    delete chunkServicesRef.current[fileId];
  }, []);

  const startUpload = useCallback(
    (fileId, fileName, fileSize, isChunked = false, totalChunks = 0) => {
      const startTime = Date.now();

      setUploadProgress((prev) => ({
        ...prev,
        [fileId]: {
          fileName,
          fileSize,
          uploadedBytes: 0,
          progress: 0,
          speed: 0,
          startTime,
          status: "uploading",
          // Chunked upload specific fields
          isChunked,
          totalChunks,
          uploadedChunks: 0,
          chunkStatus: isChunked ? new Array(totalChunks).fill("pending") : [],
          retryAttempts: 0,
          failedChunks: [],
        },
      }));

      progressDataRef.current[fileId] = {
        startTime,
        lastUpdateTime: startTime,
        lastUploadedBytes: 0,
        chunkRetries: {},
      };

      setUploading(true);
    },
    []
  );

  const updateProgress = useCallback(
    (
      fileId,
      uploadedBytes,
      totalBytes = null,
      uploadedChunks = null,
      totalChunks = null
    ) => {
      const currentTime = Date.now();
      const progressData = progressDataRef.current[fileId];

      if (!progressData) return;

      // Update progress data
      progressData.lastUpdateTime = currentTime;
      progressData.lastUploadedBytes = uploadedBytes;

      setUploadProgress((prev) => {
        const current = prev[fileId];
        if (!current) return prev;

        const fileSize = totalBytes || current.fileSize;
        // Ensure uploadedBytes never exceeds fileSize to prevent >100% progress
        const safeUploadedBytes = Math.min(uploadedBytes, fileSize);
        const progress = Math.min((safeUploadedBytes / fileSize) * 100, 100);

        // Calculate average speed from start
        const totalTime = (currentTime - progressData.startTime) / 1000;
        const averageSpeed = totalTime > 0 ? safeUploadedBytes / totalTime : 0;

        return {
          ...prev,
          [fileId]: {
            ...current,
            uploadedBytes: safeUploadedBytes,
            progress,
            speed: averageSpeed,
            // Update chunked upload fields if provided
            ...(uploadedChunks !== null && { uploadedChunks }),
            ...(totalChunks !== null && { totalChunks }),
          },
        };
      });
    },
    []
  );

  // New callback for chunk-specific progress updates
  const updateChunkProgress = useCallback(
    (fileId, chunkIndex, chunkStatus, retryAttempt = 0) => {
      const progressData = progressDataRef.current[fileId];
      if (!progressData) return;

      // Track chunk retries
      if (retryAttempt > 0) {
        if (!progressData.chunkRetries[chunkIndex]) {
          progressData.chunkRetries[chunkIndex] = 0;
        }
        progressData.chunkRetries[chunkIndex] = retryAttempt;
      }

      setUploadProgress((prev) => {
        const current = prev[fileId];
        if (!current || !current.isChunked) return prev;

        const newChunkStatus = [...current.chunkStatus];
        newChunkStatus[chunkIndex] = chunkStatus;

        // Update failed chunks list
        const failedChunks = [...current.failedChunks];
        if (chunkStatus === "failed" && !failedChunks.includes(chunkIndex)) {
          failedChunks.push(chunkIndex);
        } else if (chunkStatus === "completed") {
          const failedIndex = failedChunks.indexOf(chunkIndex);
          if (failedIndex > -1) {
            failedChunks.splice(failedIndex, 1);
          }
        }

        // Calculate total retry attempts
        const totalRetries = Object.values(progressData.chunkRetries).reduce(
          (sum, retries) => sum + retries,
          0
        );

        return {
          ...prev,
          [fileId]: {
            ...current,
            chunkStatus: newChunkStatus,
            failedChunks,
            retryAttempts: totalRetries,
          },
        };
      });
    },
    []
  );

  const completeUpload = useCallback(
    (fileId, success = true, uploadStats = null) => {
      const currentTime = Date.now();

      setUploadProgress((prev) => {
        const current = prev[fileId];
        if (!current) return prev;

        // Calculate final stats
        const totalTime = (currentTime - current.startTime) / 1000; // in seconds
        const finalSpeed = totalTime > 0 ? current.fileSize / totalTime : 0;

        return {
          ...prev,
          [fileId]: {
            ...current,
            progress: 100,
            status: success ? "completed" : "error",
            completedTime: currentTime,
            totalTime: totalTime,
            finalSpeed: finalSpeed,
            // Add chunked upload completion stats if available
            ...(uploadStats && {
              serverStats: uploadStats,
              totalRetries: uploadStats.totalRetries || current.retryAttempts,
            }),
          },
        };
      });

      // Clean up progress data
      delete progressDataRef.current[fileId];

      // Check if any uploads are still active
      setUploadProgress((current) => {
        const hasActiveUploads = Object.values(current).some(
          (upload) => upload.status === "uploading"
        );

        if (!hasActiveUploads) {
          setUploading(false);
        }

        return current;
      });

      // Note: Toast will persist until manually closed by user
      // No auto-close functionality
    },
    []
  );

  const cancelUpload = useCallback((fileId) => {
    // Get current upload info for user feedback
    setUploadProgress((prev) => {
      const current = prev[fileId];
      if (current) {
        // Show cancelling status immediately
        return {
          ...prev,
          [fileId]: {
            ...current,
            status: "cancelling",
          },
        };
      }
      return prev;
    });

    // Cancel via chunk service if available
    const chunkService = chunkServicesRef.current[fileId];
    if (chunkService) {
      chunkService
        .cancelUpload(fileId)
        .then((success) => {
          if (success) {
            logger.info("Upload cancelled successfully", { fileId });
          }
        })
        .catch((err) => {
          logger.logError(err, "Failed to cancel upload", { fileId });
        })
        .finally(() => {
          delete chunkServicesRef.current[fileId];
        });
    }

    // Clean up upload progress after a short delay to show "cancelling" status
    setTimeout(() => {
      setUploadProgress((prev) => {
        const current = prev[fileId];
        if (current) {
          // Mark as cancelled instead of removing immediately
          return {
            ...prev,
            [fileId]: {
              ...current,
              status: "cancelled",
              completedTime: Date.now(),
            },
          };
        }
        return prev;
      });

      delete progressDataRef.current[fileId];

      // Check if any uploads are still active
      setUploadProgress((current) => {
        const hasActiveUploads = Object.values(current).some(
          (upload) =>
            upload.status === "uploading" || upload.status === "cancelling"
        );

        if (!hasActiveUploads) {
          setUploading(false);
        }

        return current;
      });
    }, 300); // Short delay to show cancelling status
  }, []);

  const pauseUpload = useCallback((fileId) => {
    // Pause via chunk service if available
    const chunkService = chunkServicesRef.current[fileId];
    if (chunkService) {
      chunkService
        .pauseUpload(fileId)
        .then(() => {
          logger.info("Upload paused successfully", { fileId });
          // After pausing, ensure UI reflects accurate paused state
          // The chunk service will trigger onProgress callback with accurate values
        })
        .catch((err) => {
          logger.logError(err, "Failed to pause upload", { fileId });
        });
    }

    setUploadProgress((prev) => {
      const current = prev[fileId];
      if (!current || current.status !== "uploading") return prev;

      return {
        ...prev,
        [fileId]: {
          ...current,
          status: "paused",
          pausedTime: Date.now(),
          // Preserve current progress values when pausing
        },
      };
    });
  }, []);

  const resumeUpload = useCallback((fileId) => {
    // Resume via chunk service if available
    const chunkService = chunkServicesRef.current[fileId];
    if (chunkService) {
      chunkService
        .resumeUpload(fileId)
        .then(() => {
          // After resuming, the chunk service will trigger onProgress callback
          // with accurate current values before continuing uploads
        })
        .catch((err) => {
          console.error("Failed to resume upload:", err);
        });
    }

    setUploadProgress((prev) => {
      const current = prev[fileId];
      if (!current || current.status !== "paused") return prev;

      // Update start time to account for pause duration
      const pauseDuration = Date.now() - (current.pausedTime || Date.now());
      const progressData = progressDataRef.current[fileId];
      if (progressData) {
        progressData.startTime += pauseDuration;
      }

      return {
        ...prev,
        [fileId]: {
          ...current,
          status: "uploading",
          pausedTime: undefined,
          // Progress values will be updated by onProgress callback from chunk service
        },
      };
    });
  }, []);

  const pauseAll = useCallback(() => {
    setUploadProgress((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((fileId) => {
        if (updated[fileId].status === "uploading") {
          updated[fileId] = {
            ...updated[fileId],
            status: "paused",
            pausedTime: Date.now(),
          };
        }
      });
      return updated;
    });
  }, []);

  const resumeAll = useCallback(() => {
    const currentTime = Date.now();
    setUploadProgress((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((fileId) => {
        if (updated[fileId].status === "paused") {
          // Update start time to account for pause duration
          const pauseDuration =
            currentTime - (updated[fileId].pausedTime || currentTime);
          const progressData = progressDataRef.current[fileId];
          if (progressData) {
            progressData.startTime += pauseDuration;
          }

          updated[fileId] = {
            ...updated[fileId],
            status: "uploading",
            pausedTime: undefined,
          };
        }
      });
      return updated;
    });
  }, []);

  const cancelAll = useCallback(() => {
    const currentTime = Date.now();

    // Get all active upload IDs from current state
    setUploadProgress((prev) => {
      const activeUploadIds = Object.keys(prev).filter(
        (fileId) =>
          prev[fileId].status === "uploading" ||
          prev[fileId].status === "paused"
      );

      // Cancel each upload individually for proper cleanup
      activeUploadIds.forEach((fileId) => {
        const chunkService = chunkServicesRef.current[fileId];
        if (chunkService) {
          chunkService
            .cancelUpload(fileId)
            .catch((err) => {
              console.error(`Failed to cancel upload ${fileId}:`, err);
            })
            .finally(() => {
              delete chunkServicesRef.current[fileId];
            });
        }
      });

      const updated = { ...prev };
      Object.keys(updated).forEach((fileId) => {
        if (
          updated[fileId].status === "uploading" ||
          updated[fileId].status === "paused"
        ) {
          if (updated[fileId].isChunked) {
            updated[fileId] = {
              ...updated[fileId],
              status: "cancelled",
              completedTime: currentTime,
            };
          } else {
            delete updated[fileId];
          }
          delete progressDataRef.current[fileId];
        }
      });
      return updated;
    });

    // Check if any uploads are still active
    setUploadProgress((current) => {
      const hasActiveUploads = Object.values(current).some(
        (upload) =>
          upload.status === "uploading" || upload.status === "cancelling"
      );

      if (!hasActiveUploads) {
        setUploading(false);
      }

      return current;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setUploading(false);
    setUploadProgress({});
    progressDataRef.current = {};
  }, []);

  return {
    uploading,
    uploadProgress,
    startUpload,
    updateProgress,
    updateChunkProgress,
    completeUpload,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    pauseAll,
    resumeAll,
    cancelAll,
    resetProgress,
    registerChunkService,
    unregisterChunkService,
  };
};
