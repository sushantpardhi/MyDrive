package main

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

type JobItem struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type Job struct {
	JobId      string    `json:"jobId"`
	Items      []JobItem `json:"items"`
	UserId     string    `json:"userId"`
	OutputDir  string    `json:"outputDir"`
	RetryCount int       `json:"retryCount"`
}

const (
	zipQueueName      = "zip:jobs"
	zipRetryQueueName = "zip:retry"
	maxRetryAttempts  = 3
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Redis
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
		DB:   0,
	})
	defer rdb.Close()

	workerCount := 2
	if raw := os.Getenv("ZIP_WORKER_CONCURRENCY"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err == nil && parsed > 0 {
			workerCount = parsed
		}
	}

	// Check connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Printf("Connected to Redis at %s:%s", redisHost, redisPort)

	// Setup graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("Zip worker started with concurrency=%d. Waiting for jobs...", workerCount)
	var wg sync.WaitGroup
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go runWorker(ctx, &wg, rdb, i+1)
	}

	// Wait for shutdown signal
	<-quit
	log.Println("Shutting down worker...")
	cancel()
	wg.Wait()
	log.Println("Zip worker shutdown complete")
}

func runWorker(ctx context.Context, wg *sync.WaitGroup, rdb *redis.Client, workerID int) {
	defer wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		result, err := rdb.BLPop(ctx, 5*time.Second, zipRetryQueueName, zipQueueName).Result()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			log.Printf("[worker-%d] Redis error: %v", workerID, err)
			time.Sleep(500 * time.Millisecond)
			continue
		}

		if len(result) < 2 {
			continue
		}

		jobJSON := result[1]
		var job Job
		if err := json.Unmarshal([]byte(jobJSON), &job); err != nil {
			log.Printf("[worker-%d] Failed to unmarshal job: %v", workerID, err)
			continue
		}

		log.Printf("[worker-%d] Processing job: %s (Items: %d, Retry: %d)", workerID, job.JobId, len(job.Items), job.RetryCount)
		if err := processJob(ctx, rdb, job); err != nil {
			handleJobFailure(ctx, rdb, job, err)
		}
	}
}

func processJob(ctx context.Context, rdb *redis.Client, job Job) error {
	statusKey := fmt.Sprintf("zip:job:%s", job.JobId)

	if err := updateJobStatus(ctx, rdb, statusKey, map[string]any{
		"status":    "PROCESSING",
		"progress":  "0",
		"message":   "Processing",
		"updatedAt": strconv.FormatInt(time.Now().UnixMilli(), 10),
	}); err != nil {
		return fmt.Errorf("failed to set processing status: %w", err)
	}

	if len(job.Items) == 0 {
		return fmt.Errorf("job has no items")
	}

	// Create output dir if not exists
	if err := os.MkdirAll(job.OutputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	outputPath := filepath.Join(job.OutputDir, fmt.Sprintf("%s.zip", job.JobId))

	// Create zip file
	zipFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	archive := zip.NewWriter(zipFile)
	defer archive.Close()

	totalItems := len(job.Items)
	successfulItems := 0

	for i, item := range job.Items {
		// Update progress
		if i%10 == 0 || i == totalItems-1 {
			progress := fmt.Sprintf("%d", (i*100)/totalItems)
			_ = updateJobStatus(ctx, rdb, statusKey, map[string]any{
				"progress":  progress,
				"updatedAt": strconv.FormatInt(time.Now().UnixMilli(), 10),
			})
		}

		// Open source file
		f, err := os.Open(item.Source)
		if err != nil {
			log.Printf("Warning: Failed to open file %s: %v", item.Source, err)
			continue // Skip missing files? Or fail? Let's skip and log.
		}

		// Create zip entry
		w, err := archive.Create(item.Target)
		if err != nil {
			f.Close()
			log.Printf("Warning: Failed to add file to zip %s: %v", item.Target, err)
			continue
		}

		// Copy content
		if _, err := io.Copy(w, f); err != nil {
			f.Close()
			log.Printf("Warning: Failed to write file content %s: %v", item.Target, err)
			continue
		}
		f.Close()
		successfulItems++
	}

	if successfulItems == 0 {
		_ = archive.Close()
		_ = zipFile.Close()
		_ = os.Remove(outputPath)
		return fmt.Errorf("no valid files were written to archive")
	}

	// Close archive to flush
	if err := archive.Close(); err != nil {
		zipFile.Close()       // Close before removing
		os.Remove(outputPath) // Cleanup
		return fmt.Errorf("failed to finalize zip: %w", err)
	}

	// Ensure file is closed
	zipFile.Close()

	// Update status to READY
	if err := updateJobStatus(ctx, rdb, statusKey, map[string]any{
		"status":      "READY",
		"progress":    "100",
		"message":     "Ready",
		"filePath":    outputPath,
		"totalItems":  strconv.Itoa(totalItems),
		"itemsZipped": strconv.Itoa(successfulItems),
		"updatedAt":   strconv.FormatInt(time.Now().UnixMilli(), 10),
	}); err != nil {
		return fmt.Errorf("failed to mark job ready: %w", err)
	}

	log.Printf("Job %s completed. File: %s", job.JobId, outputPath)
	return nil
}

func handleJobFailure(ctx context.Context, rdb *redis.Client, job Job, err error) {
	statusKey := fmt.Sprintf("zip:job:%s", job.JobId)
	message := err.Error()
	job.RetryCount++

	if job.RetryCount < maxRetryAttempts {
		payload, marshalErr := json.Marshal(job)
		if marshalErr != nil {
			log.Printf("Job %s marshal failed during retry: %v", job.JobId, marshalErr)
			_ = markJobFailed(ctx, rdb, statusKey, "job marshal failed")
			return
		}

		if pushErr := rdb.RPush(ctx, zipRetryQueueName, payload).Err(); pushErr != nil {
			log.Printf("Job %s requeue failed: %v", job.JobId, pushErr)
			_ = markJobFailed(ctx, rdb, statusKey, fmt.Sprintf("retry enqueue failed: %v", pushErr))
			return
		}

		_ = updateJobStatus(ctx, rdb, statusKey, map[string]any{
			"status":     "RETRY",
			"message":    message,
			"retryCount": strconv.Itoa(job.RetryCount),
			"maxRetries": strconv.Itoa(maxRetryAttempts),
			"updatedAt":  strconv.FormatInt(time.Now().UnixMilli(), 10),
		})
		log.Printf("Job %s failed and requeued (%d/%d): %v", job.JobId, job.RetryCount, maxRetryAttempts, err)
		return
	}

	_ = markJobFailed(ctx, rdb, statusKey, message)
	log.Printf("Job %s failed permanently after %d attempts: %v", job.JobId, job.RetryCount, err)
}

func markJobFailed(ctx context.Context, rdb *redis.Client, statusKey, message string) error {
	return updateJobStatus(ctx, rdb, statusKey, map[string]any{
		"status":    "FAILED",
		"message":   message,
		"updatedAt": strconv.FormatInt(time.Now().UnixMilli(), 10),
	})
}

func updateJobStatus(ctx context.Context, rdb *redis.Client, statusKey string, updates map[string]any) error {
	return rdb.HSet(ctx, statusKey, updates).Err()
}
