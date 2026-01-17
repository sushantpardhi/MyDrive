package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type WorkerPool struct {
	workerCount   int
	redisClient   *RedisClient
	gpuDispatcher *GPUDispatcher
	maxRetries    int
	dataDir       string
}

func NewWorkerPool(workerCount int, rc *RedisClient, gd *GPUDispatcher, maxRetries int, dataDir string) *WorkerPool {
	return &WorkerPool{
		workerCount:   workerCount,
		redisClient:   rc,
		gpuDispatcher: gd,
		maxRetries:    maxRetries,
		dataDir:       dataDir,
	}
}

func (wp *WorkerPool) Start(ctx context.Context) {
	var wg sync.WaitGroup

	for i := 0; i < wp.workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			wp.runWorker(ctx, workerID)
		}(i)
	}

	wg.Wait()
	log.Println("[POOL] All workers stopped")
}

func (wp *WorkerPool) runWorker(ctx context.Context, workerID int) {
	logger := log.New(os.Stdout, fmt.Sprintf("[WORKER-%d] ", workerID), log.LstdFlags)
	logger.Println("Started")

	for {
		select {
		case <-ctx.Done():
			logger.Println("Stopped")
			return
		default:
		}

		job, err := wp.redisClient.FetchJob(ctx, QueueNameJobs)
		if err != nil {
			if err.Error() == "timeout" {
				job, err = wp.redisClient.FetchJob(ctx, QueueNameRetry)
				if err != nil {
					if err.Error() != "timeout" {
						logger.Printf("Error fetching from retry queue: %v", err)
						time.Sleep(1 * time.Second)
					}
					continue
				}
			} else {
				logger.Printf("Error fetching job: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}
		}

		wp.processJobSafe(ctx, logger, job)
	}
}

func (wp *WorkerPool) processJobSafe(ctx context.Context, logger *log.Logger, job *Job) {
	defer func() {
		if r := recover(); r != nil {
			logger.Printf("PANIC in job %s: %v - moving to retry", job.JobID, r)
			_ = wp.retryJob(ctx, job)
		}
	}()

	wp.processJob(ctx, logger, job)
}

func (wp *WorkerPool) processJob(ctx context.Context, logger *log.Logger, job *Job) {
	logger.Printf("Processing job %s with operations: %v", job.JobID, job.Operations)
	startTime := time.Now()

	if err := job.Validate(); err != nil {
		logger.Printf("Job %s validation failed: %v", job.JobID, err)
		_ = wp.redisClient.MoveToFailed(ctx, job)
		return
	}

	// Use the outputDir provided by the server (server/uploads/<userId>/processed)
	outputDir := job.OutputDir
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		logger.Printf("Failed to create output dir for job %s: %v", job.JobID, err)
		_ = wp.retryJob(ctx, job)
		return
	}

	inputImageBytes, err := os.ReadFile(job.InputPath)
	if err != nil {
		logger.Printf("Failed to read input image %s: %v", job.InputPath, err)
		_ = wp.retryJob(ctx, job)
		return
	}

	logger.Printf("Input image read: %d bytes", len(inputImageBytes))

	var currentImageBytes []byte = inputImageBytes

	for _, op := range job.Operations {
		result, err := wp.gpuDispatcher.ProcessImage(ctx, currentImageBytes, op, job.JobID)
		if err != nil {
			logger.Printf("GPU processing failed for job %s operation %s: %v", job.JobID, op, err)
			_ = wp.cleanupOutputFiles(outputDir)
			_ = wp.retryJob(ctx, job)
			return
		}

		currentImageBytes = result.Data

		// Follow server naming convention: jobId_operation.webp
		// jobId already contains the unique identifier from the server (UUID-filename)
		outputPath := filepath.Join(outputDir, fmt.Sprintf("%s_%s.webp", job.JobID, op))
		if err := os.WriteFile(outputPath, currentImageBytes, 0644); err != nil {
			logger.Printf("Failed to write output file %s: %v", outputPath, err)
			_ = wp.cleanupOutputFiles(outputDir)
			_ = wp.retryJob(ctx, job)
			return
		}

		logger.Printf("Operation %s complete: %s (%d bytes)", op, outputPath, len(currentImageBytes))
	}

	if err := wp.redisClient.MoveToSuccess(ctx, job); err != nil {
		logger.Printf("Failed to mark job %s as done: %v", job.JobID, err)
		return
	}

	duration := time.Since(startTime)
	logger.Printf("Job %s completed successfully in %v", job.JobID, duration)
}

func (wp *WorkerPool) retryJob(ctx context.Context, job *Job) error {
	job.RetryCount++

	if job.RetryCount >= wp.maxRetries {
		log.Printf("[RETRY] Job %s exceeded max retries (%d), moving to failed", job.JobID, wp.maxRetries)
		return wp.redisClient.MoveToFailed(ctx, job)
	}

	log.Printf("[RETRY] Job %s retry attempt %d/%d", job.JobID, job.RetryCount, wp.maxRetries)
	return wp.redisClient.PushToQueue(ctx, QueueNameRetry, job)
}

func (wp *WorkerPool) cleanupOutputFiles(outputDir string) error {
	if _, err := os.Stat(outputDir); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			path := filepath.Join(outputDir, entry.Name())
			_ = os.Remove(path)
		}
	}

	return nil
}
