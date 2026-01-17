# High-Performance GPU Image Processing Worker

## Architecture

**Worker Pool Model:**
- Multiple CPU workers fetch jobs from Redis in parallel
- Each worker handles I/O and image decoding
- Single GPU execution queue serializes GPU operations (prevents context thrashing)
- Async operation result channels ensure non-blocking job processing

**GPU Scheduling:**
- GPUDispatcher maintains serial GPU context (GTX 1650)
- Operations queued and processed one at a time
- Each operation has timeout protection (30s default)
- GPU errors isolated per job with panic recovery

**Retry Handling:**
- Primary queue: `image_jobs`
- Retry queue: `image_retry` (processed after primary)
- Failed queue: `image_failed` (after max retries)
- Success queue: `image_done`
- Max retries: 3 (configurable)

## File Structure

```
image-worker/
├── main.go                 # Entry point, flag parsing, worker initialization
├── worker.go               # Worker pool, job processing loop
├── job.go                  # Job struct, validation, serialization
├── redis.go                # Redis client, queue operations
├── cuda_bindings.go        # Go cgo bindings to CUDA
├── gpu/
│   └── dispatcher.go       # GPU operation queue, serialization
├── cuda/
│   ├── image_ops.cu        # CUDA kernels (resize, blur, downscale)
│   └── image_ops.h         # CUDA header, function signatures
├── build.sh                # Build script (nvcc + go build)
├── go.mod                  # Go module definition
└── go.sum                  # Go dependency checksums
```

## Building

### Requirements
- Linux (x86_64)
- CUDA 11+ Toolkit
- Go 1.21+
- GTX 1650 GPU

### Steps
```bash
cd /data/worker/image-worker
chmod +x build.sh
./build.sh
```

Build process:
1. Compiles CUDA kernels with nvcc (sm_75 architecture for GTX 1650)
2. Links CUDA libraries
3. Runs `go build` with CGO enabled
4. Outputs binary: `./image-worker`

## Running

```bash
# Default (4 workers, localhost Redis, /data root)
./image-worker

# Custom configuration
./image-worker -workers=8 -redis=redis.example.com:6379 -db=0 -max-retries=3 -data-dir=/data

# With logging
./image-worker -workers=4 2>&1 | tee worker.log
```

## Job Flow

1. Backend (image-upload) pushes job to Redis `image_jobs` queue
2. Worker fetches job (BRPOP)
3. Validates job structure
4. Creates `/data/processed/{jobId}` directory
5. For each operation (thumbnail → blur → low-quality):
   - Sends to GPUDispatcher
   - GPU processes image
   - Saves {jobId}_{operation}.webp
6. On success: push to `image_done`
7. On failure: retry logic → eventually `image_failed`

## CUDA Operations

**Thumbnail (256px width):**
- Bilinear resize kernel
- Maintains aspect ratio
- Output: {jobId}_thumb.webp

**Blur (Gaussian):**
- 3×3 Gaussian blur kernel
- Shared memory optimization
- Output: {jobId}_blur.webp

**Low-Quality (50% downscale):**
- Nearest-neighbor downscale kernel
- 2× reduction in both dimensions
- Output: {jobId}_lq.webp

## Performance Notes

- Single GPU serialization prevents context switching overhead
- Multiple CPU workers handle I/O concurrency
- GTX 1650 (1280 CUDA cores) handles typical image batches
- Estimated throughput: 5-10 images/sec depending on operation complexity
- Memory-efficient: streaming I/O, minimal GPU buffer overhead

## Monitoring

Check queues in Redis:
```bash
redis-cli -h localhost
> LLEN image_jobs    # Pending jobs
> LLEN image_retry   # Retrying jobs
> LLEN image_done    # Completed jobs
> LLEN image_failed  # Failed jobs
```

## Error Handling

- Panic per job (doesn't crash worker)
- GPU errors logged and job retried
- Redis disconnect triggers exponential backoff
- Partial outputs cleaned up on failure
- Graceful shutdown (SIGINT/SIGTERM)
