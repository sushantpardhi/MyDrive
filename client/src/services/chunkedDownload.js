/**
 * Chunked Download Service
 * Handles file downloads in chunks with pause/resume/cancel functionality
 */

import logger from "../utils/logger";

// Configuration constants
const CHUNK_SIZE = process.env.REACT_APP_CHUNK_SIZE
  ? parseInt(process.env.REACT_APP_CHUNK_SIZE)
  : 1024 * 1024; // 1MB chunks
const MAX_RETRIES = process.env.REACT_APP_MAX_RETRIES
  ? parseInt(process.env.REACT_APP_MAX_RETRIES)
  : 3;
const RETRY_DELAY_BASE = 1000; // Base delay in ms
const MAX_CONCURRENT_DOWNLOADS = 4; // Parallel chunk downloads

const triggerBrowserDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export class ChunkedDownloadService {
  constructor(api, onProgress = null, onChunkProgress = null) {
    this.api = api;
    this.onProgress = onProgress;
    this.onChunkProgress = onChunkProgress;
    this.activeDownloads = new Map();
    this.abortControllers = new Map();
  }

  /**
   * Calculate optimal concurrency based on file size
   */
  calculateOptimalConcurrency(fileSize, totalChunks) {
    const fileSizeMB = fileSize / (1024 * 1024);

    let concurrency;
    if (fileSizeMB < 50) {
      concurrency = Math.min(6, Math.max(2, Math.ceil(totalChunks / 5)));
    } else if (fileSizeMB < 200) {
      concurrency = Math.min(4, Math.max(2, Math.ceil(totalChunks / 10)));
    } else {
      concurrency = Math.min(3, Math.max(2, Math.ceil(totalChunks / 20)));
    }

    return Math.min(Math.max(concurrency, 2), MAX_CONCURRENT_DOWNLOADS);
  }

  supportsFileSystemAccess() {
    return (
      typeof window !== "undefined" &&
      typeof window.showSaveFilePicker === "function"
    );
  }

  async createDownloadOutput(fileName, fileSize) {
    if (!this.supportsFileSystemAccess()) {
      return { mode: "memory", fileName, closed: false };
    }

    const fileHandle = await window.showSaveFilePicker({
      suggestedName: fileName,
    });
    const writable = await fileHandle.createWritable();

    if (typeof writable.truncate === "function") {
      await writable.truncate(fileSize);
    }

    return {
      mode: "filesystem",
      fileName,
      fileHandle,
      writable,
      closed: false,
    };
  }

  normalizeChunkData(data) {
    if (data instanceof Uint8Array) {
      return data;
    }

    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }

    return data;
  }

  async persistChunk(downloadState, chunk, data) {
    const normalizedData = this.normalizeChunkData(data);

    if (downloadState.output?.mode === "filesystem") {
      await downloadState.output.writable.write({
        type: "write",
        position: chunk.index * downloadState.chunkSize,
        data: normalizedData,
      });
      chunk.data = null;
    } else {
      chunk.data = normalizedData;
    }

    chunk.downloaded = true;
    chunk.size = normalizedData.byteLength || normalizedData.size || 0;

    return chunk.size;
  }

  updateProgressState(downloadState, clientDownloadId) {
    if (this.onProgress) {
      this.onProgress(
        clientDownloadId,
        downloadState.downloadedBytes,
        downloadState.fileSize,
        downloadState.downloadedChunks,
        downloadState.totalChunks,
      );
    }
  }

  async finalizeDownloadOutput(downloadState, fileName) {
    const finalName = fileName || downloadState.preferredFileName;

    if (downloadState.output?.mode === "filesystem") {
      await downloadState.output.writable.close();
      downloadState.output.closed = true;
      return;
    }

    const orderedChunks = downloadState.chunks
      .sort((a, b) => a.index - b.index)
      .map((chunk) => chunk.data);

    const blob = new Blob(orderedChunks);
    triggerBrowserDownload(blob, finalName);
  }

  async discardDownloadOutput(downloadState) {
    if (!downloadState?.output || downloadState.output.closed) {
      return;
    }

    if (downloadState.output.mode === "filesystem") {
      if (typeof downloadState.output.writable.abort === "function") {
        await downloadState.output.writable.abort();
      } else {
        await downloadState.output.writable.close();
      }
    }

    downloadState.output.closed = true;
  }

  /**
   * Download a single chunk with retry logic
   */
  async downloadChunk(downloadId, chunkIndex, abortSignal = null) {
    let retries = 0;
    const chunkStartTime = Date.now();

    while (retries <= MAX_RETRIES) {
      try {
        // Check if download is cancelled
        if (abortSignal && abortSignal.aborted) {
          return null;
        }

        // Notify chunk is downloading
        if (this.onChunkProgress) {
          this.onChunkProgress(downloadId, chunkIndex, "downloading", retries);
        }

        // Download the chunk
        const response = await this.api.downloadChunk(
          downloadId,
          chunkIndex,
          abortSignal
        );

        // Success - update progress
        if (this.onChunkProgress) {
          this.onChunkProgress(downloadId, chunkIndex, "completed", retries);
        }

        return {
          index: chunkIndex,
          data: response.data,
          size: response.data.byteLength || response.data.size,
          downloadTime: Date.now() - chunkStartTime,
        };
      } catch (error) {
        // Check if request was aborted (paused/cancelled)
        if (error.name === "AbortError" || error.name === "CanceledError") {
          if (this.onChunkProgress) {
            this.onChunkProgress(downloadId, chunkIndex, "paused", retries);
          }
          return null;
        }

        // Check if download is paused on server (409)
        if (
          error.response?.status === 409 &&
          error.response?.data?.status === "paused"
        ) {
          if (this.onChunkProgress) {
            this.onChunkProgress(downloadId, chunkIndex, "paused", retries);
          }
          return null;
        }

        // Check if download was cancelled on server (410)
        if (error.response?.status === 410) {
          if (this.onChunkProgress) {
            this.onChunkProgress(downloadId, chunkIndex, "cancelled", retries);
          }
          throw new Error("Download was cancelled");
        }

        retries++;

        // Update chunk progress
        if (this.onChunkProgress) {
          this.onChunkProgress(downloadId, chunkIndex, "retrying", retries);
        }

        // Check if retryable
        const isRetryable = this.isRetryableError(error);

        if (retries > MAX_RETRIES || !isRetryable) {
          if (this.onChunkProgress) {
            this.onChunkProgress(downloadId, chunkIndex, "failed", retries);
          }
          throw new Error(
            `Chunk ${chunkIndex} failed after ${retries} attempts: ${error.message}`
          );
        }

        // Exponential backoff
        const delay = Math.min(
          RETRY_DELAY_BASE * Math.pow(1.5, retries - 1) + Math.random() * 500,
          10000
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    // Network errors
    if (error.code === "NETWORK_ERROR" || error.code === "ECONNRESET") {
      return true;
    }

    // Timeout errors
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return true;
    }

    // Server errors (5xx)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting (429)
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Client errors (4xx except 429) are not retryable
    if (
      error.response &&
      error.response.status >= 400 &&
      error.response.status < 500 &&
      error.response.status !== 429
    ) {
      return false;
    }

    return true;
  }

  /**
   * Initiate and download file in chunks
   */
  async downloadFile(fileId, fileName = null, downloadId = null) {
    const uniqueDownloadId =
      downloadId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create abort controller
      const abortController = new AbortController();
      this.abortControllers.set(uniqueDownloadId, abortController);

      // Step 1: Initiate download session on server
      const initiateResponse = await this.api.initiateChunkedDownload({
        fileId,
      });

      const session = initiateResponse.data.session;
      const serverDownloadId = session.downloadId;

      logger.info("Chunked download started", {
        downloadId: serverDownloadId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        totalChunks: session.totalChunks,
      });

      // Store download state
      const downloadState = {
        downloadId: serverDownloadId,
        fileId,
        fileName: session.fileName,
        preferredFileName: fileName || session.fileName,
        fileSize: session.fileSize,
        totalChunks: session.totalChunks,
        chunkSize: session.chunkSize,
        status: "downloading",
        downloadedBytes: 0,
        downloadedChunks: 0,
        chunks: [],
        output: null,
        startTime: Date.now(),
      };

      this.activeDownloads.set(uniqueDownloadId, downloadState);
      this.abortControllers.set(uniqueDownloadId, abortController);
      downloadState.output = await this.createDownloadOutput(
        downloadState.preferredFileName,
        session.fileSize,
      );

      // Step 2: Download chunks in parallel
      const chunks = [];
      for (let i = 0; i < session.totalChunks; i++) {
        chunks.push({
          index: i,
          downloaded: false,
          data: null,
        });
      }
      downloadState.chunks = chunks;

      const concurrency = this.calculateOptimalConcurrency(
        session.fileSize,
        session.totalChunks
      );

      // Semaphore for concurrency control
      class Semaphore {
        constructor(count) {
          this.count = count;
          this.waiting = [];
        }

        async acquire() {
          return new Promise((resolve) => {
            if (this.count > 0) {
              this.count--;
              resolve();
            } else {
              this.waiting.push(resolve);
            }
          });
        }

        release() {
          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            resolve();
          } else {
            this.count++;
          }
        }
      }

      const semaphore = new Semaphore(concurrency);
      let downloadedBytes = 0;
      let downloadedChunks = 0;

      // Download all chunks in parallel with concurrency limit
      const downloadPromises = chunks.map(async (chunk, index) => {
        await semaphore.acquire();

        try {
          const result = await this.downloadChunk(
            serverDownloadId,
            index,
            abortController.signal
          );

          if (result === null) {
            // Download was paused/cancelled
            throw new Error("Download paused or cancelled");
          }

          const persistedSize = await this.persistChunk(
            downloadState,
            chunk,
            result.data,
          );
          downloadedChunks++;
          downloadedBytes += persistedSize;
          downloadState.downloadedChunks = downloadedChunks;
          downloadState.downloadedBytes = downloadedBytes;
          this.updateProgressState(downloadState, uniqueDownloadId);

          return result;
        } finally {
          semaphore.release();
        }
      });

      // Wait for all chunks
      const results = await Promise.allSettled(downloadPromises);

      // Check for failures
      const failures = results.filter((r) => r.status === "rejected");
      const pausedOrCancelled = failures.some(
        (f) =>
          f.reason.message.includes("paused") ||
          f.reason.message.includes("cancelled")
      );

      if (pausedOrCancelled) {
        downloadState.status = "paused";
        return {
          success: false,
          paused: true,
          downloadId: serverDownloadId,
          clientDownloadId: uniqueDownloadId,
          message: "Download paused or cancelled",
        };
      }

      if (failures.length > 0) {
        throw failures[0].reason;
      }

      await this.finalizeDownloadOutput(downloadState, downloadState.preferredFileName);

      // Update state
      downloadState.status = "completed";
      downloadState.completedAt = Date.now();

      logger.info("Chunked download completed", {
        downloadId: serverDownloadId,
        fileName: session.fileName,
        duration: Date.now() - downloadState.startTime,
      });

      // Cleanup
      this.activeDownloads.delete(uniqueDownloadId);
      this.abortControllers.delete(uniqueDownloadId);

      return {
        success: true,
        downloadId: serverDownloadId,
        clientDownloadId: uniqueDownloadId,
        fileName: downloadState.preferredFileName,
        fileSize: session.fileSize,
        duration: Date.now() - downloadState.startTime,
      };
    } catch (error) {
      // Update error state
      const downloadState = this.activeDownloads.get(uniqueDownloadId);
      if (downloadState) {
        downloadState.status = "failed";
        downloadState.error = error.message;
        await this.discardDownloadOutput(downloadState);
      }

      logger.logError(error, "Chunked download failed", {
        downloadId: uniqueDownloadId,
      });

      throw error;
    }
  }

  /**
   * Pause an active download
   */
  async pauseDownload(clientDownloadId) {
    const downloadState = this.activeDownloads.get(clientDownloadId);
    if (!downloadState) {
      return false;
    }

    try {
      // Abort all in-flight chunk downloads
      const abortController = this.abortControllers.get(clientDownloadId);
      if (abortController) {
        abortController.abort();
      }

      // Pause on server
      if (downloadState.downloadId) {
        await this.api.pauseChunkedDownload(downloadState.downloadId);
        downloadState.status = "paused";
        downloadState.pausedAt = Date.now();
        this.updateProgressState(downloadState, clientDownloadId);
      }

      logger.info("Download paused", {
        downloadId: downloadState.downloadId,
        clientDownloadId,
      });

      return true;
    } catch (error) {
      logger.logError(error, "Failed to pause download", { clientDownloadId });
      return false;
    }
  }

  /**
   * Resume a paused download
   */
  async resumeDownload(clientDownloadId) {
    const downloadState = this.activeDownloads.get(clientDownloadId);
    if (!downloadState) {
      return false;
    }

    try {
      // Create new abort controller
      const newAbortController = new AbortController();
      this.abortControllers.set(clientDownloadId, newAbortController);

      // Resume on server
      if (downloadState.downloadId) {
        const response = await this.api.resumeChunkedDownload(
          downloadState.downloadId
        );

        downloadState.status = "downloading";
        const pauseDuration = Date.now() - (downloadState.pausedAt || Date.now());
        downloadState.totalPausedTime =
          (downloadState.totalPausedTime || 0) + pauseDuration;
        delete downloadState.pausedAt;

        // Get missing chunks and resume downloading
        const missingChunks = response.data.missingChunks || [];
        if (missingChunks.length > 0) {
          // Resume downloading missing chunks
          await this.resumeChunkDownloads(
            clientDownloadId,
            downloadState,
            missingChunks,
            newAbortController.signal
          );
        }
      }

      logger.info("Download resumed", {
        downloadId: downloadState.downloadId,
        clientDownloadId,
      });

      return true;
    } catch (error) {
      logger.logError(error, "Failed to resume download", { clientDownloadId });
      return false;
    }
  }

  /**
   * Resume downloading missing chunks
   */
  async resumeChunkDownloads(
    clientDownloadId,
    downloadState,
    missingChunkIndices,
    abortSignal
  ) {
    const { downloadId, chunks, fileSize, totalChunks } = downloadState;

    const concurrency = this.calculateOptimalConcurrency(fileSize, totalChunks);

    class Semaphore {
      constructor(count) {
        this.count = count;
        this.waiting = [];
      }

      async acquire() {
        return new Promise((resolve) => {
          if (this.count > 0) {
            this.count--;
            resolve();
          } else {
            this.waiting.push(resolve);
          }
        });
      }

      release() {
        if (this.waiting.length > 0) {
          this.waiting.shift()();
        } else {
          this.count++;
        }
      }
    }

    const semaphore = new Semaphore(concurrency);

    const downloadPromises = missingChunkIndices.map(async (chunkIndex) => {
      await semaphore.acquire();

      try {
        const result = await this.downloadChunk(
          downloadId,
          chunkIndex,
          abortSignal
        );

        if (result) {
          const chunk = chunks[chunkIndex];
          const persistedSize = await this.persistChunk(
            downloadState,
            chunk,
            result.data,
          );

          downloadState.downloadedChunks += 1;
          downloadState.downloadedBytes += persistedSize;
          this.updateProgressState(downloadState, clientDownloadId);
        }

        return result;
      } finally {
        semaphore.release();
      }
    });

    try {
      const results = await Promise.allSettled(downloadPromises);

      // Check if all chunks are downloaded
      const allDownloaded = chunks.every((c) => c.downloaded);

      if (allDownloaded) {
        await this.finalizeDownloadOutput(
          downloadState,
          downloadState.preferredFileName,
        );

        downloadState.status = "completed";
        downloadState.completedAt = Date.now();

        // Cleanup
        this.activeDownloads.delete(clientDownloadId);
        this.abortControllers.delete(clientDownloadId);

        logger.info("Resumed download completed", {
          downloadId,
          clientDownloadId,
        });
      }
    } catch (error) {
      logger.logError(error, "Error resuming chunk downloads", {
        downloadId,
        clientDownloadId,
      });
      await this.discardDownloadOutput(downloadState);
    }
  }

  /**
   * Cancel an active download
   */
  async cancelDownload(clientDownloadId) {
    const downloadState = this.activeDownloads.get(clientDownloadId);
    if (!downloadState) {
      return false;
    }

    try {
      // Mark as cancelling
      downloadState.status = "cancelling";

      // Abort all in-flight downloads
      const abortController = this.abortControllers.get(clientDownloadId);
      if (abortController) {
        abortController.abort();
      }

      // Cancel on server
      if (downloadState.downloadId) {
        try {
          await this.api.cancelChunkedDownload(downloadState.downloadId);
        } catch (serverError) {
          // Server cancellation failed, continue with local cleanup
          logger.logError(serverError, "Server cancellation failed");
        }
      }

      await this.discardDownloadOutput(downloadState);

      // Cleanup local state
      this.activeDownloads.delete(clientDownloadId);
      this.abortControllers.delete(clientDownloadId);

      logger.info("Download cancelled", {
        downloadId: downloadState.downloadId,
        clientDownloadId,
      });

      return true;
    } catch (error) {
      logger.logError(error, "Failed to cancel download", { clientDownloadId });
      await this.discardDownloadOutput(downloadState);
      // Ensure cleanup happens even on error
      this.activeDownloads.delete(clientDownloadId);
      this.abortControllers.delete(clientDownloadId);
      return false;
    }
  }

  /**
   * Get download progress
   */
  getDownloadProgress(clientDownloadId) {
    return this.activeDownloads.get(clientDownloadId) || null;
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads() {
    return Array.from(this.activeDownloads.entries()).map(
      ([clientDownloadId, state]) => ({
        clientDownloadId,
        ...state,
      })
    );
  }
}

// Helper function to create chunked download service instance
export const createChunkedDownloadService = (
  api,
  onProgress,
  onChunkProgress
) => {
  return new ChunkedDownloadService(api, onProgress, onChunkProgress);
};

// Export constants
export { CHUNK_SIZE, MAX_RETRIES, MAX_CONCURRENT_DOWNLOADS };
