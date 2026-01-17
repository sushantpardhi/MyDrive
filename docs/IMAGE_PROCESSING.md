# Image Processing Integration

This document describes the integration between the Node.js server and the Go image processing worker through Redis queue.

## Overview

When users upload image files to the server, they are automatically sent to a Redis queue for asynchronous GPU-accelerated processing. The Go worker picks up these jobs, processes the images (generating thumbnails, blur versions, and low-quality versions), and saves them in the server's upload directory following the same naming conventions.

## Architecture

```
User Upload → Server (Node.js) → Redis Queue → Worker (Go + CUDA) → Processed Images
                ↓                                                          ↓
          Original File                                         uploads/<userId>/processed/
          uploads/<userId>/                                     <jobId>_thumbnail.webp
          <uuid>-<filename>                                     <jobId>_blur.webp
                                                                <jobId>_low-quality.webp
```

## Server Configuration

### 1. Environment Variables

Add to your `.env` file:

```env
# Redis Configuration (for Image Processing Worker)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### 2. Redis Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Windows:**
Download from https://redis.io/download or use Docker:
```bash
docker run -d -p 6379:6379 redis:latest
```

### 3. Server Features

The server automatically:
- Detects image files by MIME type (jpeg, png, gif, webp, bmp, tiff, svg)
- Sends image processing jobs to Redis queue `image:jobs`
- Continues to work even if Redis is unavailable (graceful degradation)
- Logs all queue operations for monitoring

## Job Format

Jobs sent to Redis queue follow this format:

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890-image",
  "inputPath": "/absolute/path/to/uploads/userId/a1b2c3d4-e5f6-7890-abcd-ef1234567890-image.jpg",
  "outputDir": "/absolute/path/to/uploads/userId/processed",
  "operations": ["thumbnail", "blur", "low-quality"],
  "timestamp": 1737158400000,
  "retryCount": 0
}
```

### Field Descriptions

- **jobId**: Unique identifier extracted from the uploaded filename (UUID without extension)
- **inputPath**: Absolute path to the original uploaded image
- **outputDir**: Absolute path where processed images will be saved (`uploads/<userId>/processed`)
- **operations**: Array of operations to perform
  - `thumbnail`: Generate a thumbnail version
  - `blur`: Generate a blurred version
  - `low-quality`: Generate a low-quality/compressed version
- **timestamp**: Unix timestamp in milliseconds when job was created
- **retryCount**: Number of retry attempts (starts at 0)

## Worker Configuration

### 1. Prerequisites

- Go 1.21 or later
- CUDA Toolkit 11.0+ (for GPU acceleration)
- Redis server running

### 2. Building the Worker

```bash
cd worker/image-worker
go build -o image-worker
```

### 3. Running the Worker

The worker needs to know where the server's upload directory is located. Since the server sends absolute paths in jobs, the worker uses these paths directly.

**Basic usage:**
```bash
./image-worker \
  -redis localhost:6379 \
  -db 0 \
  -workers 4 \
  -max-retries 3
```

**Command-line flags:**
- `-redis`: Redis server address (default: `localhost:6379`)
- `-db`: Redis database number (default: `0`)
- `-workers`: Number of CPU worker goroutines (default: `4`)
- `-max-retries`: Maximum retry attempts per job (default: `3`)

### 4. Worker Behavior

The worker:
1. Connects to Redis and listens for jobs on `image:jobs` queue
2. Uses BRPOP (blocking right pop) to fetch jobs in FIFO order
3. Creates the output directory if it doesn't exist: `uploads/<userId>/processed`
4. Processes each image with GPU acceleration
5. Saves processed images with naming convention: `<jobId>_<operation>.webp`
6. Moves successful jobs to `image:done` queue
7. Retries failed jobs up to max-retries times via `image:retry` queue
8. Moves permanently failed jobs to `image:failed` queue

## Directory Structure

```
server/
├── uploads/
│   └── <userId>/                    # User-specific directory
│       ├── <uuid>-<filename>.jpg    # Original uploaded file
│       └── processed/               # Processed images directory
│           ├── <uuid>-<filename>_thumbnail.webp
│           ├── <uuid>-<filename>_blur.webp
│           └── <uuid>-<filename>_low-quality.webp
```

### Naming Convention

Server uses UUID-based filenames:
- Original: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-vacation.jpg`
- Thumbnail: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-vacation_thumbnail.webp`
- Blur: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-vacation_blur.webp`
- Low-quality: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-vacation_low-quality.webp`

The jobId is the UUID + base filename (without extension).

## Redis Queues

### Queue Names

- `image:jobs` - Pending jobs (FIFO order)
- `image:retry` - Jobs being retried after failure
- `image:failed` - Permanently failed jobs (after max retries)
- `image:done` - Successfully completed jobs

### Queue Operations

**Server (Push):**
```javascript
await redisClient.rPush('image:jobs', JSON.stringify(job));
```

**Worker (Pop):**
```go
results, err := redisClient.BRPop(ctx, timeout, queueName).Result()
```

## Monitoring

### Server Logs

Monitor server logs for queue operations:
```bash
# In server directory
tail -f logs/combined.log | grep -i "image processing"
```

Example log entries:
```
info: Image processing job sent to queue {"jobId":"abc123","fileName":"photo.jpg","userId":"user123","operations":["thumbnail","blur","low-quality"]}
warn: Redis not connected - skipping image processing job {"fileName":"photo.jpg"}
error: Failed to send image job to queue {"error":"Connection refused","fileName":"photo.jpg"}
```

### Worker Logs

Worker provides detailed logging:
```
[MAIN] Starting Image Worker with 4 CPU workers
[MAIN] Redis: localhost:6379, DB: 0
[WORKER-0] Started
[WORKER-0] Processing job abc123 with operations: [thumbnail blur low-quality]
[WORKER-0] Input image read: 2458624 bytes
[WORKER-0] Operation thumbnail complete: /path/to/processed/abc123_thumbnail.webp (45678 bytes)
[WORKER-0] Job abc123 completed successfully in 234ms
```

### Queue Statistics

Check queue status using Redis CLI:
```bash
redis-cli

# Check queue lengths
LLEN image:jobs      # Pending jobs
LLEN image:retry     # Retrying jobs
LLEN image:failed    # Failed jobs
LLEN image:done      # Completed jobs

# View jobs (without removing)
LRANGE image:jobs 0 -1
LRANGE image:failed 0 -1
```

## Error Handling

### Server-Side

- **Redis Unavailable**: Server logs warning and continues without queuing
- **Invalid Job Data**: Server logs error but upload succeeds
- **Queue Error**: Server logs error and continues

The app will NOT crash if Redis is unavailable.

### Worker-Side

- **Invalid Job**: Moved to `image:failed` queue immediately
- **Processing Error**: Retried up to max-retries times
- **File Not Found**: Retried (in case of network delay)
- **GPU Error**: Retried (GPU might recover)

## Testing

### 1. Start Redis
```bash
redis-server
```

### 2. Start Server
```bash
cd server
npm start
```

### 3. Start Worker
```bash
cd worker/image-worker
./image-worker -workers 4
```

### 4. Upload an Image

Use the client UI or curl:
```bash
curl -X POST http://localhost:8080/api/files/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test-image.jpg" \
  -F "parent=root"
```

### 5. Verify Processing

Check the processed directory:
```bash
ls -la server/uploads/<userId>/processed/
```

You should see three processed files:
- `*_thumbnail.webp`
- `*_blur.webp`
- `*_low-quality.webp`

## Troubleshooting

### Images Not Being Processed

1. **Check Redis Connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check Server Logs:**
   ```bash
   grep -i "redis\|image processing" server/logs/combined.log
   ```

3. **Check Worker is Running:**
   ```bash
   ps aux | grep image-worker
   ```

4. **Check Queue Status:**
   ```bash
   redis-cli LLEN image:jobs
   ```

### Worker Not Processing Jobs

1. **Verify Redis Connection:**
   Check worker logs for "Redis client initialized"

2. **Check CUDA Availability:**
   ```bash
   nvidia-smi
   ```

3. **Test Manual Job:**
   ```bash
   redis-cli RPUSH image:jobs '{"jobId":"test","inputPath":"/path/to/image.jpg","outputDir":"/path/to/output","operations":["thumbnail"],"timestamp":1737158400000,"retryCount":0}'
   ```

### Files Not Found

- Ensure worker has read access to `uploads/<userId>/` directory
- Ensure worker has write access to `uploads/<userId>/processed/` directory
- Check that paths in Redis jobs are absolute paths
- Verify file ownership and permissions

## Performance Tuning

### Worker Configuration

- **Increase workers for more parallelism:**
  ```bash
  ./image-worker -workers 8
  ```

- **Adjust retry limit:**
  ```bash
  ./image-worker -max-retries 5
  ```

### Redis Configuration

For high-volume scenarios, adjust Redis settings in `/etc/redis/redis.conf`:
```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## Production Deployment

### Using PM2 for Worker

```bash
# Install PM2
npm install -g pm2

# Start worker with PM2
pm2 start image-worker --name "image-processor" -- -workers 4 -redis localhost:6379

# Monitor
pm2 logs image-processor
pm2 status
```

### Using Docker Compose

See `docker-compose.yml` for complete setup with server, worker, MongoDB, and Redis.

### Environment Variables for Production

```env
REDIS_HOST=redis-server.example.com
REDIS_PORT=6379
REDIS_DB=0
```

## Security Considerations

1. **Redis Authentication**: Enable Redis password in production
   ```env
   REDIS_PASSWORD=your-secure-password
   ```

2. **Network Security**: Use private network for Redis communication

3. **File Permissions**: Ensure processed files have appropriate permissions

4. **Input Validation**: Worker validates all job fields before processing

5. **Resource Limits**: Set appropriate worker count to avoid resource exhaustion

## Future Enhancements

Potential improvements:
- Support for additional image formats
- Configurable image quality settings
- Custom operation parameters per job
- Progress tracking for long-running jobs
- Dead letter queue with alerting
- Metrics and monitoring dashboard
- Auto-scaling based on queue depth
