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
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

type JobItem struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type Job struct {
	JobId     string    `json:"jobId"`
	Items     []JobItem `json:"items"`
	UserId    string    `json:"userId"`
	OutputDir string    `json:"outputDir"`
}

// Global context for graceful shutdown
var ctx = context.Background()

func main() {
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

	// Check connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Printf("Connected to Redis at %s:%s", redisHost, redisPort)

	// Setup graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Consumer loop
	log.Println("Worker started. Waiting for jobs...")
	go func() {
		for {
			// Blocking pop from list
			// timeout 0 blocks indefinitely, but we can't cancel it easily in some clients?
			// Actually go-redis BLPOP takes a timeout. We loop with 5 seconds to check for signals?
			result, err := rdb.BLPop(ctx, 5*time.Second, "zip:jobs").Result()
			if err != nil {
				if err == redis.Nil {
					continue // Timeout, loop again
				}
				// If context canceled (during shutdown)
				if ctx.Err() != nil {
					return
				}
				log.Printf("Redis error: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			// result[0] is key, result[1] is value
			jobJSON := result[1]
			var job Job
			if err := json.Unmarshal([]byte(jobJSON), &job); err != nil {
				log.Printf("Failed to unmarshal job: %v", err)
				continue
			}

			log.Printf("Processing job: %s (Items: %d)", job.JobId, len(job.Items))
			processJob(rdb, job)
		}
	}()

	// Wait for shutdown signal
	<-quit
	log.Println("Shutting down worker...")
	// Cancel context if we used one for BLPOP
}

func processJob(rdb *redis.Client, job Job) {
	statusKey := fmt.Sprintf("zip:job:%s", job.JobId)

	// Update status to PROCESSING
	rdb.HSet(ctx, statusKey, "status", "PROCESSING")
	rdb.HSet(ctx, statusKey, "progress", "0")

	// Create output dir if not exists
	if err := os.MkdirAll(job.OutputDir, 0755); err != nil {
		failJob(rdb, statusKey, fmt.Sprintf("Failed to create output directory: %v", err))
		return
	}

	outputPath := filepath.Join(job.OutputDir, fmt.Sprintf("%s.zip", job.JobId))
	
	// Create zip file
	zipFile, err := os.Create(outputPath)
	if err != nil {
		failJob(rdb, statusKey, fmt.Sprintf("Failed to create zip file: %v", err))
		return
	}
	defer zipFile.Close() // Ensure close if we error out, though we close explicitly later

	archive := zip.NewWriter(zipFile)
	defer archive.Close()

	totalItems := len(job.Items)
	
	for i, item := range job.Items {
		// Update progress
		if i%10 == 0 || i == totalItems-1 {
			progress := fmt.Sprintf("%d", (i * 100) / totalItems)
			rdb.HSet(ctx, statusKey, "progress", progress)
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
	}

	// Close archive to flush
	if err := archive.Close(); err != nil {
		zipFile.Close() // Close before removing
		os.Remove(outputPath) // Cleanup
		failJob(rdb, statusKey, fmt.Sprintf("Failed to finalize zip: %v", err))
		return
	}
	
	// Ensure file is closed
	zipFile.Close()

	// Update status to READY
	rdb.HSet(ctx, statusKey, "status", "READY")
	rdb.HSet(ctx, statusKey, "progress", "100")
	rdb.HSet(ctx, statusKey, "filePath", outputPath)
	
	log.Printf("Job %s completed. File: %s", job.JobId, outputPath)
}

func failJob(rdb *redis.Client, key, message string) {
	log.Printf("Job failed: %s", message)
	rdb.HSet(ctx, key, "status", "FAILED")
	rdb.HSet(ctx, key, "message", message)
}
