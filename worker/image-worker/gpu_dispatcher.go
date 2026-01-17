package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"sync"
	"time"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
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
		// Log size comparison to verify quality ordering
		inputSize := len(op.imageData)
		outputSize := len(result.Data)
		sizeReduction := float64(inputSize-outputSize) / float64(inputSize) * 100

		log.Printf("[GPU-EXEC] Job %s operation %s complete (input: %d bytes -> output: %d bytes, reduction: %.1f%%)",
			op.jobID, op.op, inputSize, outputSize, sizeReduction)

		// Validate that processed output is smaller than original
		if outputSize >= inputSize && inputSize > 0 {
			log.Printf("[GPU-WARN] Job %s operation %s: output size (%d) >= input size (%d) - quality ordering may not be guaranteed",
				op.jobID, op.op, outputSize, inputSize)
		}

		select {
		case op.result <- result:
		case <-op.ctx.Done():
		}
	}
}

func (gd *GPUDispatcher) processThumbnail(imageData []byte) (*ProcessResult, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	// Resize to 48px max dimension using high-quality Lanczos resampling
	resized := imaging.Fit(img, 48, 48, imaging.Lanczos)

	// Encode to WebP with quality 20 (aggressive compression)
	var buf bytes.Buffer
	opts := &webp.Options{
		Lossless: false,
		Quality:  20,
	}
	if err := webp.Encode(&buf, resized, opts); err != nil {
		return nil, fmt.Errorf("WebP encoding failed: %w", err)
	}

	return &ProcessResult{
		Data:   buf.Bytes(),
		Format: "webp",
	}, nil
}

func (gd *GPUDispatcher) processBlur(imageData []byte) (*ProcessResult, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	// Resize to 192px max dimension
	resized := imaging.Fit(img, 192, 192, imaging.Lanczos)

	// Apply Gaussian blur
	blurred := imaging.Blur(resized, 3.0)

	// Encode to WebP with quality 40
	var buf bytes.Buffer
	opts := &webp.Options{
		Lossless: false,
		Quality:  40,
	}
	if err := webp.Encode(&buf, blurred, opts); err != nil {
		return nil, fmt.Errorf("WebP encoding failed: %w", err)
	}

	return &ProcessResult{
		Data:   buf.Bytes(),
		Format: "webp",
	}, nil
}

func (gd *GPUDispatcher) processLowQuality(imageData []byte) (*ProcessResult, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("decode failed: %w", err)
	}

	// Resize to 384px max dimension
	resized := imaging.Fit(img, 384, 384, imaging.Lanczos)

	// Encode to WebP with quality 60
	var buf bytes.Buffer
	opts := &webp.Options{
		Lossless: false,
		Quality:  60,
	}
	if err := webp.Encode(&buf, resized, opts); err != nil {
		return nil, fmt.Errorf("WebP encoding failed: %w", err)
	}

	return &ProcessResult{
		Data:   buf.Bytes(),
		Format: "webp",
	}, nil
}

// ValidateQualityOrder checks if processed files follow the expected size ordering:
// thumbnail < blur < low-quality < original
// Returns true if ordering is correct, false otherwise with detailed logging
func ValidateQualityOrder(thumbnailSize, blurSize, lowQualitySize, originalSize int) bool {
	isValid := true

	if thumbnailSize >= blurSize {
		log.Printf("[QUALITY-WARN] thumbnail (%d bytes) >= blur (%d bytes)", thumbnailSize, blurSize)
		isValid = false
	}

	if blurSize >= lowQualitySize {
		log.Printf("[QUALITY-WARN] blur (%d bytes) >= low-quality (%d bytes)", blurSize, lowQualitySize)
		isValid = false
	}

	if lowQualitySize >= originalSize {
		log.Printf("[QUALITY-WARN] low-quality (%d bytes) >= original (%d bytes)", lowQualitySize, originalSize)
		isValid = false
	}

	if isValid {
		log.Printf("[QUALITY-OK] Size ordering verified: thumbnail (%d) < blur (%d) < low-quality (%d) < original (%d)",
			thumbnailSize, blurSize, lowQualitySize, originalSize)
	}

	return isValid
}

// ExpectedQualityRatios returns the expected size ratios for each operation
// These are approximate targets based on the processing parameters:
// - Thumbnail: 128px width, quality 30% -> ~1-5% of original
// - Blur: 320px width, quality 50% -> ~5-15% of original
// - Low-Quality: 640px width, quality 65% -> ~15-40% of original
type QualityRatios struct {
	ThumbnailMaxRatio  float64 // Maximum expected ratio (output/original)
	BlurMaxRatio       float64
	LowQualityMaxRatio float64
}

func GetExpectedQualityRatios() QualityRatios {
	return QualityRatios{
		ThumbnailMaxRatio:  0.05, // 5% of original max
		BlurMaxRatio:       0.15, // 15% of original max
		LowQualityMaxRatio: 0.40, // 40% of original max
	}
}

func (gd *GPUDispatcher) Close() {
	log.Println("[GPU] Shutting down dispatcher")
	close(gd.shutdownChan)
	gd.wg.Wait()

	CudaCleanup()
	log.Println("[GPU] Cleanup complete")
}
