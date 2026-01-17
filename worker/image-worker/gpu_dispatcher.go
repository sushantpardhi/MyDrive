package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"
)

type ProcessResult struct {
	Data   []byte
	Format string
}

type GPUDispatcher struct {
	mu               sync.Mutex
	gpuInitialized   bool
	operationQueue   chan *gpuOperation
	shutdownChan     chan struct{}
	wg               sync.WaitGroup
	maxQueueSize     int
	operationTimeout time.Duration
}

type gpuOperation struct {
	op        string
	imageData []byte
	jobID     string
	result    chan *ProcessResult
	err       chan error
	ctx       context.Context
}

func NewGPUDispatcher() *GPUDispatcher {
	gd := &GPUDispatcher{
		operationQueue:   make(chan *gpuOperation, 100),
		shutdownChan:     make(chan struct{}),
		maxQueueSize:     100,
		operationTimeout: 30 * time.Second,
	}

	if err := CudaInit(); err != nil {
		log.Fatalf("[GPU] CUDA initialization failed: %v", err)
	}

	gd.gpuInitialized = true
	log.Println("[GPU] CUDA initialized successfully")

	gd.wg.Add(1)
	go gd.processOperations()

	return gd
}

func (gd *GPUDispatcher) ProcessImage(ctx context.Context, imageData []byte, operation string, jobID string) (*ProcessResult, error) {
	if !gd.gpuInitialized {
		return nil, errors.New("GPU not initialized")
	}

	validOps := map[string]bool{"thumbnail": true, "blur": true, "low-quality": true}
	if !validOps[operation] {
		return nil, fmt.Errorf("invalid operation: %s", operation)
	}

	resultChan := make(chan *ProcessResult, 1)
	errChan := make(chan error, 1)

	op := &gpuOperation{
		op:        operation,
		imageData: imageData,
		jobID:     jobID,
		result:    resultChan,
		err:       errChan,
		ctx:       ctx,
	}

	select {
	case gd.operationQueue <- op:
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(5 * time.Second):
		return nil, errors.New("GPU queue full (operation timeout)")
	}

	select {
	case result := <-resultChan:
		return result, nil
	case err := <-errChan:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(gd.operationTimeout):
		return nil, fmt.Errorf("GPU operation timeout for job %s operation %s", jobID, operation)
	}
}

func (gd *GPUDispatcher) processOperations() {
	defer gd.wg.Done()

	for {
		select {
		case <-gd.shutdownChan:
			log.Println("[GPU-PROC] Shutdown signal received")
			return
		case op := <-gd.operationQueue:
			gd.executeOperation(op)
		}
	}
}

func (gd *GPUDispatcher) executeOperation(op *gpuOperation) {
	gd.mu.Lock()
	defer gd.mu.Unlock()

	log.Printf("[GPU-EXEC] Job %s operation %s starting (input size: %d bytes)", op.jobID, op.op, len(op.imageData))

	var result *ProcessResult
	var err error

	switch op.op {
	case "thumbnail":
		result, err = gd.processThumbnail(op.imageData)
	case "blur":
		result, err = gd.processBlur(op.imageData)
	case "low-quality":
		result, err = gd.processLowQuality(op.imageData)
	default:
		err = fmt.Errorf("unknown operation: %s", op.op)
	}

	if err != nil {
		log.Printf("[GPU-EXEC] Job %s operation %s failed: %v", op.jobID, op.op, err)
		select {
		case op.err <- err:
		case <-op.ctx.Done():
		}
	} else {
		log.Printf("[GPU-EXEC] Job %s operation %s complete (output size: %d bytes)", op.jobID, op.op, len(result.Data))
		select {
		case op.result <- result:
		case <-op.ctx.Done():
		}
	}
}

func (gd *GPUDispatcher) processThumbnail(imageData []byte) (*ProcessResult, error) {
	return &ProcessResult{
		Data:   CudaProcessThumbnail(imageData),
		Format: "webp",
	}, nil
}

func (gd *GPUDispatcher) processBlur(imageData []byte) (*ProcessResult, error) {
	return &ProcessResult{
		Data:   CudaProcessBlur(imageData),
		Format: "webp",
	}, nil
}

func (gd *GPUDispatcher) processLowQuality(imageData []byte) (*ProcessResult, error) {
	return &ProcessResult{
		Data:   CudaProcessLowQuality(imageData),
		Format: "webp",
	}, nil
}

func (gd *GPUDispatcher) Close() {
	log.Println("[GPU] Shutting down dispatcher")
	close(gd.shutdownChan)
	gd.wg.Wait()

	CudaCleanup()
	log.Println("[GPU] Cleanup complete")
}
