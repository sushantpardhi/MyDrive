import { useState, useCallback } from "react";

export const useDownloadProgress = () => {
  const [downloadProgress, setDownloadProgress] = useState({});

  const startDownload = useCallback(
    (downloadId, fileName, fileSize = 0, totalFiles = 1) => {
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
          startTime: Date.now(),
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
    (downloadId, loadedBytes, totalBytes = null, speed = 0) => {
      setDownloadProgress((prev) => {
        const current = prev[downloadId];
        if (!current) return prev;

        const fileSize = totalBytes || current.fileSize;
        const progress = fileSize > 0 ? (loadedBytes / fileSize) * 100 : 0;

        // Calculate speed if not provided
        let calculatedSpeed = speed;
        if (!speed && current.lastUpdateTime) {
          const timeDiff = (Date.now() - current.lastUpdateTime) / 1000;
          const bytesDiff = loadedBytes - (current.uploadedBytes || 0);
          calculatedSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
        }

        return {
          ...prev,
          [downloadId]: {
            ...current,
            uploadedBytes: loadedBytes,
            fileSize,
            progress: Math.min(progress, 100),
            speed: calculatedSpeed,
            phase: "downloading",
            status: "downloading",
            lastUpdateTime: Date.now(),
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

    // Auto-remove after 5 seconds if successful
    if (success) {
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const { [downloadId]: _, ...rest } = prev;
          return rest;
        });
      }, 5000);
    }
  }, []);

  const cancelDownload = useCallback((downloadId) => {
    setDownloadProgress((prev) => {
      const { [downloadId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setDownloadProgress({});
  }, []);

  return {
    downloadProgress,
    startDownload,
    updateZippingProgress,
    updateProgress,
    completeDownload,
    cancelDownload,
    resetProgress,
  };
};
