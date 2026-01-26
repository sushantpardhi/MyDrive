import { useState, useCallback, useRef } from "react";

// Smoothing factor for exponential moving average (0.1 = very smooth, 0.5 = responsive)
const SPEED_SMOOTHING_FACTOR = 0.2;

export const useDownloadProgress = () => {
  const [downloadProgress, setDownloadProgress] = useState({});
  // Ref to store speed history for smoothing
  const speedDataRef = useRef({});
  // Ref to store XHR instances for pause/resume/cancel
  const xhrRef = useRef({});
  // Ref to store chunk service instances for pause/resume/cancel
  const chunkServicesRef = useRef({});

  // Register XHR instance for a download (allows external cancel/pause)
  const registerXhr = useCallback((downloadId, xhr) => {
    xhrRef.current[downloadId] = xhr;
  }, []);

  // Unregister XHR instance
  const unregisterXhr = useCallback((downloadId) => {
    delete xhrRef.current[downloadId];
  }, []);

  // Register chunk service for chunked downloads
  const registerChunkService = useCallback((downloadId, chunkService) => {
    chunkServicesRef.current[downloadId] = chunkService;
  }, []);

  // Unregister chunk service
  const unregisterChunkService = useCallback((downloadId) => {
    delete chunkServicesRef.current[downloadId];
  }, []);

  const startDownload = useCallback(
    (downloadId, fileName, fileSize = 0, totalFiles = 1, isChunked = false, totalChunks = 0) => {
      const startTime = Date.now();
      
      // Initialize speed tracking data
      speedDataRef.current[downloadId] = {
        startTime,
        lastUpdateTime: startTime,
        lastBytes: 0,
        smoothedSpeed: 0,
        speedSamples: [],
      };

      setDownloadProgress((prev) => ({
        ...prev,
        [downloadId]: {
          fileName,
          fileSize,
          totalFiles,
          uploadedBytes: 0,
          progress: 0,
          speed: 0,
          status: "preparing",
          type: "download",
          phase: "preparing", // preparing, zipping, downloading
          zippingProgress: 0,
          filesProcessed: 0,
          startTime,
          // Chunked download specific fields
          isChunked,
          totalChunks,
          downloadedChunks: 0,
          chunkStatus: isChunked ? new Array(totalChunks).fill("pending") : [],
          failedChunks: [],
          retryAttempts: 0,
        },
      }));
    },
    []
  );

  const updateZippingProgress = useCallback(
    (downloadId, filesProcessed, totalFiles) => {
      setDownloadProgress((prev) => {
        const current = prev[downloadId];
        if (!current) return prev;

        const zippingProgress =
          totalFiles > 0 ? (filesProcessed / totalFiles) * 100 : 0;

        return {
          ...prev,
          [downloadId]: {
            ...current,
            phase: "zipping",
            status: "zipping",
            zippingProgress: Math.min(zippingProgress, 100),
            filesProcessed,
          },
        };
      });
    },
    []
  );

  const updateProgress = useCallback(
    (downloadId, loadedBytes, totalBytes = null, instantSpeed = 0) => {
      setDownloadProgress((prev) => {
        const current = prev[downloadId];
        if (!current) return prev;

        const fileSize = totalBytes || current.fileSize;
        const progress = fileSize > 0 ? (loadedBytes / fileSize) * 100 : 0;
        const currentTime = Date.now();

        // Get or initialize speed tracking data
        let speedData = speedDataRef.current[downloadId];
        if (!speedData) {
          speedData = {
            startTime: current.startTime || currentTime,
            lastUpdateTime: currentTime,
            lastBytes: 0,
            smoothedSpeed: 0,
            speedSamples: [],
          };
          speedDataRef.current[downloadId] = speedData;
        }

        // Calculate average speed from start (like uploads do)
        const totalTime = (currentTime - speedData.startTime) / 1000;
        const averageSpeed = totalTime > 0 ? loadedBytes / totalTime : 0;

        // Calculate instantaneous speed if not provided
        let currentInstantSpeed = instantSpeed;
        if (!instantSpeed && speedData.lastUpdateTime) {
          const timeDiff = (currentTime - speedData.lastUpdateTime) / 1000;
          const bytesDiff = loadedBytes - speedData.lastBytes;
          currentInstantSpeed = timeDiff > 0.1 ? bytesDiff / timeDiff : speedData.smoothedSpeed;
        }

        // Apply exponential moving average for smoothing
        // Blend between average speed and smoothed instant speed for stability
        let smoothedSpeed;
        if (speedData.smoothedSpeed === 0) {
          // First update - use average speed
          smoothedSpeed = averageSpeed;
        } else {
          // Apply EMA to instant speed
          const emaInstant = speedData.smoothedSpeed * (1 - SPEED_SMOOTHING_FACTOR) + 
                            currentInstantSpeed * SPEED_SMOOTHING_FACTOR;
          
          // Blend with average speed (70% EMA, 30% average for stability)
          smoothedSpeed = emaInstant * 0.7 + averageSpeed * 0.3;
        }

        // Clamp speed to prevent negative or unrealistic values
        smoothedSpeed = Math.max(0, smoothedSpeed);

        // Update speed tracking data
        speedData.lastUpdateTime = currentTime;
        speedData.lastBytes = loadedBytes;
        speedData.smoothedSpeed = smoothedSpeed;

        return {
          ...prev,
          [downloadId]: {
            ...current,
            uploadedBytes: loadedBytes,
            fileSize,
            progress: Math.min(progress, 100),
            speed: smoothedSpeed,
            phase: "downloading",
            status: "downloading",
          },
        };
      });
    },
    []
  );

  // Chunk-specific progress update for chunked downloads
  const updateChunkProgress = useCallback(
    (downloadId, chunkIndex, chunkStatus, retryAttempt = 0) => {
      setDownloadProgress((prev) => {
        const current = prev[downloadId];
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

        // Count downloaded chunks
        const downloadedChunks = newChunkStatus.filter(
          (s) => s === "completed"
        ).length;

        return {
          ...prev,
          [downloadId]: {
            ...current,
            chunkStatus: newChunkStatus,
            failedChunks,
            downloadedChunks,
            retryAttempts: current.retryAttempts + (retryAttempt > 0 ? 1 : 0),
          },
        };
      });
    },
    []
  );

  const completeDownload = useCallback((downloadId, success = true) => {
    setDownloadProgress((prev) => {
      const current = prev[downloadId];
      if (!current) return prev;

      const totalTime = (Date.now() - current.startTime) / 1000;
      const finalSpeed = totalTime > 0 ? current.fileSize / totalTime : 0;

      return {
        ...prev,
        [downloadId]: {
          ...current,
          status: success ? "completed" : "error",
          progress: success ? 100 : current.progress,
          uploadedBytes: success ? current.fileSize : current.uploadedBytes,
          phase: success ? "completed" : "error",
          totalTime,
          finalSpeed,
        },
      };
    });

    // Clean up speed tracking data and services
    delete speedDataRef.current[downloadId];
    delete chunkServicesRef.current[downloadId];

    // Note: Downloads will persist until manually removed by user
  }, []);

  const failDownload = useCallback((downloadId) => {
    // Clean up speed tracking data, XHR, and services
    delete speedDataRef.current[downloadId];
    delete xhrRef.current[downloadId];
    delete chunkServicesRef.current[downloadId];
    
    setDownloadProgress((prev) => {
      const current = prev[downloadId];
      if (!current) return prev;

      return {
        ...prev,
        [downloadId]: {
          ...current,
          status: "error",
          phase: "error",
        },
      };
    });
  }, []);

  // Pause a chunked download
  const pauseDownload = useCallback((downloadId) => {
    // Pause via chunk service if available
    const chunkService = chunkServicesRef.current[downloadId];
    if (chunkService) {
      chunkService
        .pauseDownload(downloadId)
        .then((success) => {
          if (success) {

          }
        })
        .catch((err) => {
          console.error("Failed to pause download:", err);
        });
    }

    // Also abort XHR if available
    const xhr = xhrRef.current[downloadId];
    if (xhr && xhr.readyState !== 4) {
      xhr.abort();
    }

    setDownloadProgress((prev) => {
      const current = prev[downloadId];
      if (!current || current.status !== "downloading") return prev;

      return {
        ...prev,
        [downloadId]: {
          ...current,
          status: "paused",
          phase: "paused",
          pausedTime: Date.now(),
        },
      };
    });
  }, []);

  // Resume a paused chunked download
  const resumeDownload = useCallback((downloadId) => {
    // Resume via chunk service if available
    const chunkService = chunkServicesRef.current[downloadId];
    if (chunkService) {
      chunkService
        .resumeDownload(downloadId)
        .then((success) => {
          if (success) {

          }
        })
        .catch((err) => {
          console.error("Failed to resume download:", err);
        });
    }

    setDownloadProgress((prev) => {
      const current = prev[downloadId];
      if (!current || current.status !== "paused") return prev;

      // Adjust start time to account for pause duration
      const pauseDuration = Date.now() - (current.pausedTime || Date.now());
      const speedData = speedDataRef.current[downloadId];
      if (speedData) {
        speedData.startTime += pauseDuration;
      }

      return {
        ...prev,
        [downloadId]: {
          ...current,
          status: "downloading",
          phase: "downloading",
          pausedTime: undefined,
        },
      };
    });
  }, []);

  // Cancel a specific download - aborts XHR and updates status
  const cancelDownload = useCallback((downloadId) => {
    // Cancel via chunk service if available
    const chunkService = chunkServicesRef.current[downloadId];
    if (chunkService) {
      chunkService
        .cancelDownload(downloadId)
        .then((success) => {
          if (success) {

          }
        })
        .catch((err) => {
          console.error("Failed to cancel download:", err);
        })
        .finally(() => {
          delete chunkServicesRef.current[downloadId];
        });
    }

    // Abort the XHR request if it exists
    const xhr = xhrRef.current[downloadId];
    if (xhr && xhr.readyState !== 4) {
      xhr.abort();
    }
    
    // Clean up refs
    delete speedDataRef.current[downloadId];
    delete xhrRef.current[downloadId];
    
    // Update status to cancelled (keep in list briefly to show cancelled state)
    setDownloadProgress((prev) => {
      const current = prev[downloadId];
      if (!current) return prev;

      return {
        ...prev,
        [downloadId]: {
          ...current,
          status: "cancelled",
          phase: "cancelled",
        },
      };
    });

    // Remove from list after a short delay
    setTimeout(() => {
      setDownloadProgress((prev) => {
        const { [downloadId]: _, ...rest } = prev;
        return rest;
      });
    }, 2000);
  }, []);

  // Remove a completed/failed/cancelled download from the list
  const removeDownload = useCallback((downloadId) => {
    delete speedDataRef.current[downloadId];
    delete xhrRef.current[downloadId];
    delete chunkServicesRef.current[downloadId];
    
    setDownloadProgress((prev) => {
      const { [downloadId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Pause all active downloads
  const pauseAll = useCallback(() => {
    setDownloadProgress((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((downloadId) => {
        if (updated[downloadId].status === "downloading") {
          // Pause via chunk service if available
          const chunkService = chunkServicesRef.current[downloadId];
          if (chunkService) {
            chunkService.pauseDownload(downloadId).catch(console.error);
          }

          // Abort XHR if available
          const xhr = xhrRef.current[downloadId];
          if (xhr && xhr.readyState !== 4) {
            xhr.abort();
          }

          updated[downloadId] = {
            ...updated[downloadId],
            status: "paused",
            phase: "paused",
            pausedTime: Date.now(),
          };
        }
      });
      return updated;
    });
  }, []);

  // Resume all paused downloads
  const resumeAll = useCallback(() => {
    const currentTime = Date.now();
    setDownloadProgress((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((downloadId) => {
        if (updated[downloadId].status === "paused") {
          // Resume via chunk service if available
          const chunkService = chunkServicesRef.current[downloadId];
          if (chunkService) {
            chunkService.resumeDownload(downloadId).catch(console.error);
          }

          // Adjust start time to account for pause duration
          const pauseDuration =
            currentTime - (updated[downloadId].pausedTime || currentTime);
          const speedData = speedDataRef.current[downloadId];
          if (speedData) {
            speedData.startTime += pauseDuration;
          }

          updated[downloadId] = {
            ...updated[downloadId],
            status: "downloading",
            phase: "downloading",
            pausedTime: undefined,
          };
        }
      });
      return updated;
    });
  }, []);

  const cancelAll = useCallback(() => {
    // Cancel all chunk services
    Object.entries(chunkServicesRef.current).forEach(
      ([downloadId, chunkService]) => {
        if (chunkService) {
          chunkService.cancelDownload(downloadId).catch(console.error);
        }
      }
    );

    // Abort all active XHR requests
    Object.entries(xhrRef.current).forEach(([downloadId, xhr]) => {
      if (xhr && xhr.readyState !== 4) {
        xhr.abort();
      }
    });
    
    // Clear all refs
    speedDataRef.current = {};
    xhrRef.current = {};
    chunkServicesRef.current = {};
    
    // Clear all downloads
    setDownloadProgress({});
  }, []);

  const resetProgress = useCallback(() => {
    // Cancel all chunk services
    Object.entries(chunkServicesRef.current).forEach(
      ([downloadId, chunkService]) => {
        if (chunkService) {
          chunkService.cancelDownload(downloadId).catch(console.error);
        }
      }
    );

    // Abort all active XHR requests
    Object.entries(xhrRef.current).forEach(([downloadId, xhr]) => {
      if (xhr && xhr.readyState !== 4) {
        xhr.abort();
      }
    });
    
    // Clear all refs
    speedDataRef.current = {};
    xhrRef.current = {};
    chunkServicesRef.current = {};
    setDownloadProgress({});
  }, []);

  return {
    downloadProgress,
    startDownload,
    updateZippingProgress,
    updateProgress,
    updateChunkProgress,
    completeDownload,
    failDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    removeDownload,
    pauseAll,
    resumeAll,
    cancelAll,
    resetProgress,
    registerXhr,
    unregisterXhr,
    registerChunkService,
    unregisterChunkService,
  };
};
