package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
)

var (
	workerCount = flag.Int("workers", 4, "Number of CPU worker goroutines")
	redisAddr   = flag.String("redis", "localhost:6379", "Redis address")
	redisDB     = flag.Int("db", 0, "Redis database")
	maxRetries  = flag.Int("max-retries", 3, "Maximum retry attempts per job")
	dataDir     = flag.String("data-dir", "", "Data directory root (default: ../../data relative to executable)")
)

func main() {
	flag.Parse()

	// If data directory not specified, use default relative path
	effectiveDataDir := *dataDir
	if effectiveDataDir == "" {
		execPath, err := os.Executable()
		if err != nil {
			log.Fatalf("Failed to get executable path: %v", err)
		}
		// Get the directory containing the executable
		execDir := filepath.Dir(execPath)
		// Go up two levels and into data folder
		effectiveDataDir = filepath.Join(execDir, "..", "..", "data")
		// Convert to absolute path
		effectiveDataDir, err = filepath.Abs(effectiveDataDir)
		if err != nil {
			log.Fatalf("Failed to resolve data directory: %v", err)
		}
	}

	log.Printf("[MAIN] Starting Image Worker with %d CPU workers", *workerCount)
	log.Printf("[MAIN] Redis: %s, DB: %d", *redisAddr, *redisDB)
	log.Printf("[MAIN] Data Dir: %s, Max Retries: %d", effectiveDataDir, *maxRetries)

	gpuDispatcher := NewGPUDispatcher()
	defer gpuDispatcher.Close()

	log.Println("[MAIN] GPU dispatcher initialized")

	redisClient := NewRedisClient(*redisAddr, *redisDB)
	defer redisClient.Close()

	log.Println("[MAIN] Redis client initialized")

	pool := NewWorkerPool(*workerCount, redisClient, gpuDispatcher, *maxRetries, effectiveDataDir)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		pool.Start(ctx)
	}()

	<-sigChan
	log.Println("[MAIN] Shutdown signal received")

	cancel()
	wg.Wait()

	log.Println("[MAIN] Worker shutdown complete")
}
