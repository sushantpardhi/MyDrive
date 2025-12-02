/**
 * Chunked Upload Service
 * Handles file uploads in chunks with retry functionality
 */

import logger from "../utils/logger";

const CHUNK_SIZE = process.env.REACT_APP_CHUNK_SIZE
  ? parseInt(process.env.REACT_APP_CHUNK_SIZE)
  : 1024 * 1024; // 1MB chunks
const MAX_RETRIES = process.env.REACT_APP_MAX_RETRIES
  ? parseInt(process.env.REACT_APP_MAX_RETRIES)
  : 3;
const RETRY_DELAY_BASE = 1000; // Base delay in ms

export class ChunkedUploadService {
  constructor(api, onProgress = null, onChunkProgress = null) {
    this.api = api;
    this.onProgress = onProgress;
    this.onChunkProgress = onChunkProgress;
    this.activeUploads = new Map();

    // Track upload conflicts for better coordination
    this.conflictStats = new Map();

    // Track abort controllers for each upload
    this.abortControllers = new Map();
  }

  /**
   * Split file into chunks
   */
  createChunks(file) {
    const chunks = [];
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      chunks.push({
        index: i,
        chunk,
        size: chunk.size,
        start,
        end: end - 1, // Make end inclusive
        retries: 0,
        uploaded: false,
      });
    }

    return chunks;
  }

  /**
   * Calculate MD5 hash for chunk integrity verification
   */
  async calculateChunkHash(chunk) {
    const arrayBuffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Upload a single chunk with enhanced retry logic for parallel uploads
   */
  async uploadChunk(uploadId, chunkData, fileId, abortSignal = null) {
    const { index, chunk, size, start, end } = chunkData;
    let retries = 0;
    const chunkStartTime = Date.now();

    // Pre-calculate hash to avoid recalculating on retries
    let hash = chunkData.hash;
    if (!hash) {
      hash = await this.calculateChunkHash(chunk);
      chunkData.hash = hash;
    }

    while (retries <= MAX_RETRIES) {
      try {
        // Check if upload is paused/cancelled before attempting upload
        if (abortSignal && abortSignal.aborted) {
          if (this.onChunkProgress) {
            this.onChunkProgress(fileId, index, "paused", retries);
          }
          return null;
        }

        // Upload the chunk
        const response = await this.api.uploadChunk(
          uploadId,
          {
            chunk,
            index,
            size,
            start,
            end,
            hash,
          },
          abortSignal
        );

        chunkData.uploaded = true;
        chunkData.uploadTime = Date.now() - chunkStartTime;

        // Update chunk progress
        if (this.onChunkProgress) {
          this.onChunkProgress(fileId, index, "completed", retries);
        }

        return response;
      } catch (error) {
        // Check if request was aborted (paused/cancelled)
        if (error.name === "AbortError" || error.name === "CanceledError") {
          if (this.onChunkProgress) {
            this.onChunkProgress(fileId, index, "paused", retries);
          }
          return null;
        }

        retries++;
        chunkData.retries = retries;

        // Check if upload is paused (409 with specific message)
        if (
          error.response?.status === 409 &&
          error.response?.data?.status === "paused"
        ) {
          if (this.onChunkProgress) {
            this.onChunkProgress(fileId, index, "paused", retries);
          }
          // Don't throw error, just stop trying - upload is paused
          return null;
        }

        // Determine if error is retryable
        const isRetryable = this.isRetryableError(error);

        // Track conflicts for analytics (only for actual conflicts, not paused uploads)
        if (error.response?.status === 409) {
          const conflicts = this.conflictStats.get(fileId) || {
            total: 0,
            chunks: new Set(),
          };
          conflicts.total++;
          conflicts.chunks.add(index);
          this.conflictStats.set(fileId, conflicts);
        }

        // Update chunk progress
        if (this.onChunkProgress) {
          this.onChunkProgress(fileId, index, "retrying", retries);
        }

        if (retries > MAX_RETRIES || !isRetryable) {
          if (this.onChunkProgress) {
            this.onChunkProgress(fileId, index, "failed", retries);
          }

          const errorMsg = !isRetryable
            ? `Chunk ${index} failed with non-retryable error: ${error.message}`
            : `Chunk ${index} failed after ${MAX_RETRIES} retries: ${error.message}`;

          throw new Error(errorMsg);
        }

        // Enhanced adaptive backoff for different error types
        let delay;

        if (error.response?.status === 409) {
          // Conflict errors: shorter delays with more jitter for parallel uploads
          delay = Math.min(100 + Math.random() * 200, 500);
        } else {
          // Other errors: standard exponential backoff
          const baseDelay = RETRY_DELAY_BASE * Math.pow(1.5, retries - 1);
          const jitter = Math.random() * 500;
          delay = Math.min(baseDelay + jitter, 10000);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Calculate optimal concurrency based on file size and chunk count
   */
  calculateOptimalConcurrency(fileSize, totalChunks) {
    // Base concurrency levels
    const fileSizeMB = fileSize / (1024 * 1024);

    // Determine concurrency based on file size and chunk count
    let concurrency;

    if (fileSizeMB < 50) {
      // Small files: higher concurrency for speed
      concurrency = Math.min(8, Math.max(2, Math.ceil(totalChunks / 5)));
    } else if (fileSizeMB < 200) {
      // Medium files: balanced approach
      concurrency = Math.min(6, Math.max(3, Math.ceil(totalChunks / 10)));
    } else if (fileSizeMB < 1000) {
      // Large files: moderate concurrency to avoid overwhelming server
      concurrency = Math.min(4, Math.max(2, Math.ceil(totalChunks / 20)));
    } else {
      // Very large files: conservative concurrency
      concurrency = Math.min(3, Math.max(2, Math.ceil(totalChunks / 50)));
    }

    // Ensure reasonable bounds
    return Math.min(Math.max(concurrency, 2), 10);
  }

  /**
   * Determine if an error is retryable (enhanced for parallel upload conflicts)
   */
  isRetryableError(error) {
    // Network errors are typically retryable
    if (error.code === "NETWORK_ERROR" || error.code === "ECONNRESET") {
      return true;
    }

    // Timeout errors are retryable
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting (429) is retryable
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Conflict errors (409) from parallel uploads are retryable
    if (error.response && error.response.status === 409) {
      return true;
    }

    // Check if server explicitly marked error as retryable
    if (
      error.response &&
      error.response.data &&
      error.response.data.retryable
    ) {
      return true;
    }

    // Client errors (4xx except 429 and 409) are typically not retryable
    if (
      error.response &&
      error.response.status >= 400 &&
      error.response.status < 500 &&
      error.response.status !== 409 &&
      error.response.status !== 429
    ) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Upload file in chunks with enhanced parallel processing
   */
  async uploadFile(
    file,
    parentFolder = "root",
    fileId = null,
    enableLogging = false
  ) {
    // Generate unique file ID if not provided
    const uniqueFileId =
      fileId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create abort controller for this upload
      const abortController = new AbortController();
      this.abortControllers.set(uniqueFileId, abortController);

      // Store upload state
      this.activeUploads.set(uniqueFileId, {
        file,
        parentFolder,
        status: "initiating",
        uploadedBytes: 0,
        totalBytes: file.size,
        startTime: Date.now(),
      });

      // Step 1: Initiate chunked upload
      const chunks = this.createChunks(file);
      const totalChunks = chunks.length;

      logger.logUpload("initiating", file.name, {
        fileSize: file.size,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        fileId: uniqueFileId,
      });

      const initiateResponse = await this.api.initiateChunkedUpload({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks,
        parentFolder,
        chunkSize: CHUNK_SIZE,
      });

      const uploadId = initiateResponse.data.uploadId;

      logger.info("Chunked upload started", {
        fileName: file.name,
        uploadId,
        totalChunks,
        concurrency: this.calculateOptimalConcurrency(file.size, totalChunks),
      });

      // Update upload state
      const uploadState = this.activeUploads.get(uniqueFileId);
      uploadState.status = "uploading";
      uploadState.uploadId = uploadId;
      uploadState.chunks = chunks;

      // Enable detailed logging if requested
      let logInterval = null;
      if (enableLogging) {
        logInterval = this.enableDetailedLogging(uniqueFileId);
      }

      // Step 2: Upload chunks in parallel with concurrency control
      const maxConcurrentUploads = this.calculateOptimalConcurrency(
        file.size,
        totalChunks
      );

      // Enhanced semaphore implementation with priority queue
      class ParallelSemaphore {
        constructor(count) {
          this.count = count;
          this.waiting = [];
          this.active = 0;
        }

        async acquire() {
          return new Promise((resolve) => {
            if (this.count > 0) {
              this.count--;
              this.active++;
              resolve();
            } else {
              this.waiting.push(resolve);
            }
          });
        }

        release() {
          this.active--;
          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            this.active++;
            resolve();
          } else {
            this.count++;
          }
        }

        getActiveCount() {
          return this.active;
        }
      }

      const semaphore = new ParallelSemaphore(maxConcurrentUploads);

      // Thread-safe progress tracking
      const progress = {
        uploadedChunks: 0,
        uploadedBytes: 0,
        failedChunks: [],
        lock: false,
      };

      const updateProgress = (chunkSize) => {
        // Simple lock mechanism to prevent race conditions
        while (progress.lock) {
          // Busy wait - not ideal but simple for this use case
        }
        progress.lock = true;
        progress.uploadedChunks++;
        progress.uploadedBytes += chunkSize;
        uploadState.uploadedBytes = progress.uploadedBytes;
        progress.lock = false;

        if (this.onProgress) {
          this.onProgress(
            uniqueFileId,
            progress.uploadedBytes,
            file.size,
            progress.uploadedChunks,
            totalChunks
          );
        }
      };

      // Create upload promises for all chunks (fully parallel)
      const uploadPromises = chunks.map(async (chunkData, index) => {
        await semaphore.acquire();

        try {
          // Update chunk progress to uploading
          if (this.onChunkProgress) {
            this.onChunkProgress(uniqueFileId, index, "uploading", 0);
          }

          const result = await this.uploadChunk(
            uploadId,
            chunkData,
            uniqueFileId,
            abortController.signal
          );

          // Update progress atomically
          updateProgress(chunkData.size);

          return result;
        } catch (error) {
          progress.failedChunks.push({ index, error: error.message });
          throw error;
        } finally {
          semaphore.release();
        }
      });

      // Wait for all chunks to upload in parallel
      try {
        const results = await Promise.allSettled(uploadPromises);

        // Check if upload was paused
        const pausedResults = results.filter(
          (r) => r.status === "fulfilled" && r.value === null
        );

        if (pausedResults.length > 0) {
          uploadState.status = "paused";
          logger.logUpload("paused", file.name, {
            fileId: uniqueFileId,
            uploadId,
            uploadedChunks: progress.uploadedChunks,
            totalChunks,
          });
          throw new Error("Upload paused by user");
        }

        // Check for actual failures (not pauses)
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          throw failures[0].reason;
        }
      } catch (error) {
        // If upload was paused, don't treat as error
        if (error.message === "Upload paused by user") {
          return {
            success: false,
            paused: true,
            fileId: uniqueFileId,
            uploadId,
            message: "Upload paused by user",
          };
        }

        throw error;
      }

      // Step 3: Complete the upload
      uploadState.status = "completing";

      logger.info("Completing chunked upload", {
        fileName: file.name,
        uploadId,
        totalChunks,
        uploadedChunks: progress.uploadedChunks,
      });

      const completeResponse = await this.api.completeChunkedUpload(uploadId, {
        fileName: file.name,
        totalChunks,
        chunks: chunks.map((c) => ({
          index: c.index,
          size: c.size,
          hash: c.hash,
        })),
      });

      // Update final state
      uploadState.status = "completed";
      uploadState.completedAt = Date.now();
      uploadState.fileData = completeResponse.data;

      const uploadDuration = Date.now() - uploadState.startTime;
      const totalRetries = chunks.reduce(
        (sum, chunk) => sum + chunk.retries,
        0
      );

      logger.logUpload("completed", file.name, {
        fileId: uniqueFileId,
        uploadId,
        duration: uploadDuration,
        totalRetries,
        fileSize: file.size,
        totalChunks,
      });

      // Clean up logging and state
      if (logInterval) {
        clearInterval(logInterval);
      }
      this.activeUploads.delete(uniqueFileId);
      this.abortControllers.delete(uniqueFileId);
      this.conflictStats.delete(uniqueFileId);

      // Get conflict statistics
      const conflicts = this.conflictStats.get(uniqueFileId) || {
        total: 0,
        chunks: new Set(),
      };

      return {
        success: true,
        fileId: uniqueFileId,
        fileData: completeResponse.data,
        uploadedBytes: file.size,
        totalRetries: chunks.reduce((sum, chunk) => sum + chunk.retries, 0),
        conflictStats: {
          totalConflicts: conflicts.total,
          affectedChunks: conflicts.chunks.size,
          conflictRate:
            ((conflicts.total / totalChunks) * 100).toFixed(2) + "%",
        },
      };
    } catch (error) {
      // Update error state and cleanup
      if (uniqueFileId && this.activeUploads.has(uniqueFileId)) {
        const uploadState = this.activeUploads.get(uniqueFileId);

        // Don't mark as failed if it was paused
        if (error.message === "Upload paused by user") {
          uploadState.status = "paused";
        } else {
          uploadState.status = "failed";
          uploadState.error = error.message;
          // Clean up conflict tracking only on actual failure
          this.conflictStats.delete(uniqueFileId);
        }
      }

      throw error;
    }
  }

  /**
   * Cancel an active upload with enhanced cleanup
   */
  async cancelUpload(fileId) {
    const uploadState = this.activeUploads.get(fileId);
    if (!uploadState) {
      return false;
    }

    try {
      // Mark upload as cancelling to prevent race conditions
      uploadState.status = "cancelling";

      // Immediately abort all in-flight chunk uploads
      const abortController = this.abortControllers.get(fileId);
      if (abortController) {
        abortController.abort();
      }

      // Cancel on server if upload was initiated
      if (uploadState.uploadId) {
        try {
          await this.api.cancelChunkedUpload(uploadState.uploadId);
        } catch (serverError) {
          // Server cancellation failed, continue with local cleanup
        }
      }

      // Clean up local state
      this.activeUploads.delete(fileId);
      this.abortControllers.delete(fileId);
      this.conflictStats.delete(fileId);

      // Notify completion of cancellation
      if (this.onProgress) {
        this.onProgress(fileId, 0, uploadState.file?.size || 0, 0, 0);
      }

      return true;
    } catch (error) {
      logger.logError(error, "Failed to cancel upload", { fileId });
      // Ensure cleanup happens even on error
      this.activeUploads.delete(fileId);
      this.abortControllers.delete(fileId);
      this.conflictStats.delete(fileId);
      return false;
    }
  }

  /**
   * Pause an active upload
   */
  async pauseUpload(fileId) {
    const uploadState = this.activeUploads.get(fileId);
    if (!uploadState) {
      return false;
    }

    try {
      // Immediately abort all in-flight chunk uploads
      const abortController = this.abortControllers.get(fileId);
      if (abortController) {
        abortController.abort();
      }

      // Pause on server if upload was initiated
      if (uploadState.uploadId) {
        await this.api.pauseChunkedUpload(uploadState.uploadId);
        uploadState.status = "paused";
        uploadState.pausedAt = Date.now();

        // Recalculate and report accurate progress when pausing
        if (uploadState.chunks && this.onProgress) {
          uploadState.uploadedBytes = uploadState.chunks
            .filter((c) => c.uploaded)
            .reduce((sum, c) => sum + c.size, 0);
          const uploadedChunks = uploadState.chunks.filter(
            (c) => c.uploaded
          ).length;
          this.onProgress(
            fileId,
            uploadState.uploadedBytes,
            uploadState.file.size,
            uploadedChunks,
            uploadState.chunks.length
          );
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to pause upload:", error);
      return false;
    }
  }

  /**
   * Resume a paused upload
   */
  async resumeUpload(fileId) {
    const uploadState = this.activeUploads.get(fileId);
    if (!uploadState) {
      return false;
    }

    try {
      // Create new abort controller for resumed upload
      const newAbortController = new AbortController();
      this.abortControllers.set(fileId, newAbortController);

      // Resume on server if upload was initiated
      if (uploadState.uploadId) {
        const response = await this.api.resumeChunkedUpload(
          uploadState.uploadId
        );
        uploadState.status = "uploading";
        const pauseDuration = Date.now() - (uploadState.pausedAt || Date.now());
        uploadState.totalPausedTime =
          (uploadState.totalPausedTime || 0) + pauseDuration;
        delete uploadState.pausedAt;

        // Recalculate uploadedBytes from uploaded chunks to ensure accuracy
        if (uploadState.chunks) {
          uploadState.uploadedBytes = uploadState.chunks
            .filter((c) => c.uploaded)
            .reduce((sum, c) => sum + c.size, 0);
        }

        // Get missing chunks and resume uploading them
        const missingChunks = response.data.missingChunks || [];
        if (missingChunks.length > 0 && uploadState.chunks) {
          // Resume upload for missing chunks
          this.resumeChunkUploads(
            fileId,
            uploadState,
            missingChunks,
            newAbortController.signal
          );
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to resume upload:", error);
      return false;
    }
  }

  /**
   * Resume uploading missing chunks after pause
   */
  async resumeChunkUploads(
    fileId,
    uploadState,
    missingChunkIndices,
    abortSignal
  ) {
    const { file, uploadId, chunks } = uploadState;
    if (!chunks) return;

    const missingChunks = chunks.filter(
      (chunk) => missingChunkIndices.includes(chunk.index) && !chunk.uploaded
    );

    // Recalculate uploadedBytes from scratch based on chunks marked as uploaded
    // This prevents double-counting when resuming
    uploadState.uploadedBytes = chunks
      .filter((c) => c.uploaded)
      .reduce((sum, c) => sum + c.size, 0);

    // Calculate optimal concurrency
    const maxConcurrentUploads = this.calculateOptimalConcurrency(
      file.size,
      chunks.length
    );

    // Simple semaphore for concurrency control
    class ParallelSemaphore {
      constructor(count) {
        this.count = count;
        this.waiting = [];
        this.active = 0;
      }

      async acquire() {
        return new Promise((resolve) => {
          if (this.count > 0) {
            this.count--;
            this.active++;
            resolve();
          } else {
            this.waiting.push(resolve);
          }
        });
      }

      release() {
        this.active--;
        if (this.waiting.length > 0) {
          const resolve = this.waiting.shift();
          this.active++;
          resolve();
        } else {
          this.count++;
        }
      }
    }

    const semaphore = new ParallelSemaphore(maxConcurrentUploads);

    // Upload missing chunks
    const uploadPromises = missingChunks.map(async (chunkData) => {
      await semaphore.acquire();

      try {
        if (this.onChunkProgress) {
          this.onChunkProgress(fileId, chunkData.index, "uploading", 0);
        }

        const result = await this.uploadChunk(
          uploadId,
          chunkData,
          fileId,
          abortSignal
        );

        if (result && this.onProgress) {
          // Recalculate uploadedBytes from scratch to avoid double-counting
          uploadState.uploadedBytes = chunks
            .filter((c) => c.uploaded)
            .reduce((sum, c) => sum + c.size, 0);
          const uploadedChunks = chunks.filter((c) => c.uploaded).length;
          this.onProgress(
            fileId,
            uploadState.uploadedBytes,
            file.size,
            uploadedChunks,
            chunks.length
          );
        }

        return result;
      } catch (error) {
        logger.logError(error, "Failed to upload chunk", {
          chunkIndex: chunkData.index,
          fileId,
        });
        throw error;
      } finally {
        semaphore.release();
      }
    });

    try {
      await Promise.allSettled(uploadPromises);
    } catch (error) {
      logger.logError(error, "Error resuming chunk uploads", {
        fileId,
        uploadId,
      });
    }
  }

  /**
   * Get upload progress for a file
   */
  getUploadProgress(fileId) {
    return this.activeUploads.get(fileId) || null;
  }

  /**
   * Get all active uploads
   */
  getActiveUploads() {
    return Array.from(this.activeUploads.entries()).map(([fileId, state]) => ({
      fileId,
      ...state,
    }));
  }

  /**
   * Get parallel upload statistics
   */
  getUploadStats(fileId) {
    const upload = this.activeUploads.get(fileId);
    if (!upload || !upload.chunks) {
      return null;
    }

    const chunks = upload.chunks;
    const totalChunks = chunks.length;
    const completedChunks = chunks.filter((c) => c.uploaded).length;
    const failedChunks = chunks.filter((c) => c.retries > 0).length;
    const avgRetries =
      chunks.reduce((sum, c) => sum + c.retries, 0) / totalChunks;

    const completedWithTimes = chunks.filter((c) => c.uploaded && c.uploadTime);
    const avgUploadTime =
      completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, c) => sum + c.uploadTime, 0) /
          completedWithTimes.length
        : 0;

    return {
      fileId,
      fileName: upload.file.name,
      totalChunks,
      completedChunks,
      failedChunks,
      progressPercent: ((completedChunks / totalChunks) * 100).toFixed(1),
      avgRetries: avgRetries.toFixed(2),
      avgUploadTimeMs: Math.round(avgUploadTime),
      status: upload.status,
      elapsedTime: Date.now() - upload.startTime,
    };
  }

  /**
   * Monitor parallel upload progress with detailed logging
   */
  enableDetailedLogging(fileId, intervalMs = 5000) {
    const upload = this.activeUploads.get(fileId);
    if (!upload) return null;

    const logInterval = setInterval(() => {
      const stats = this.getUploadStats(fileId);
      if (!stats) {
        clearInterval(logInterval);
        return;
      }

      if (stats.status === "completed" || stats.status === "failed") {
        clearInterval(logInterval);
      }
    }, intervalMs);

    return logInterval;
  }

  /**
   * Resume a failed upload (if supported by server)
   */
  async resumeFailedUpload(uploadId, file, fileId) {
    try {
      // Get upload status from server
      const statusResponse = await this.api.getUploadStatus(uploadId);
      const { uploadedChunks, totalChunks } = statusResponse.data;

      // Create chunks and mark uploaded ones
      const chunks = this.createChunks(file);
      uploadedChunks.forEach((chunkIndex) => {
        if (chunks[chunkIndex]) {
          chunks[chunkIndex].uploaded = true;
        }
      });

      // Resume upload with remaining chunks
      const remainingChunks = chunks.filter((chunk) => !chunk.uploaded);

      if (remainingChunks.length === 0) {
        // All chunks already uploaded, just complete
        return await this.api.completeChunkedUpload(uploadId, {
          fileName: file.name,
          totalChunks,
          chunks: chunks.map((c) => ({
            index: c.index,
            size: c.size,
            hash: c.hash,
          })),
        });
      }

      // Continue uploading remaining chunks
      // Implementation similar to uploadFile but only for remaining chunks
      // This would require refactoring the upload logic into smaller methods
    } catch (error) {
      console.error("Failed to resume upload:", error);
      throw error;
    }
  }
}

// Helper function to create chunked upload service instance
export const createChunkedUploadService = (
  api,
  onProgress,
  onChunkProgress
) => {
  return new ChunkedUploadService(api, onProgress, onChunkProgress);
};

// Export constants for external use
export { CHUNK_SIZE, MAX_RETRIES };
