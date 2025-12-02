# Winston Logger Implementation

## Overview

The MyDrive application uses Winston for centralized, structured logging with multiple transports and log levels.

## Features

### Log Levels

- **error** (0): Error messages, exceptions, and critical failures
- **warn** (1): Warning messages and potential issues
- **info** (2): General informational messages (startup, shutdown, important operations)
- **http** (3): HTTP request/response logs
- **debug** (4): Detailed debugging information (only in development)

### Log Transports

1. **Console**: Colored output for development

   - Always enabled
   - Formatted for readability with timestamps

2. **Error Log File**: `logs/error-YYYY-MM-DD.log`

   - Only error-level messages
   - Rotates daily
   - Keeps 14 days of history
   - Max file size: 20MB

3. **Combined Log File**: `logs/combined-YYYY-MM-DD.log`
   - All log levels
   - Rotates daily
   - Keeps 14 days of history
   - Max file size: 20MB

## Usage

### Basic Logging

```javascript
const logger = require("./utils/logger");

// Log levels
logger.error("Something went wrong");
logger.warn("This is a warning");
logger.info("Application started");
logger.http("HTTP request received");
logger.debug("Debugging information");
```

### Helper Methods

The logger includes specialized helper methods for common logging patterns:

#### Log Errors with Context

```javascript
try {
  // some operation
} catch (error) {
  logger.logError(error, "Context about what failed");
  // Automatically includes stack trace
}
```

#### Log HTTP Requests

```javascript
logger.logRequest(req, "User uploaded file");
// Output: User uploaded file - POST /api/files/upload - User: 123abc
```

#### Log File Operations

```javascript
logger.logFileOperation("upload", "document.pdf", userId);
// Output: File operation: upload - File: document.pdf - User: 123abc
```

#### Log Authentication Events

```javascript
logger.logAuth("login", userId, "success");
// Output: Auth: login - User: 123abc - success
```

#### Log Upload Events

```javascript
logger.logUpload("started", "video.mp4", userId, "chunked upload");
// Output: Upload started: video.mp4 - User: 123abc - chunked upload
```

#### Log Chunk Upload Progress

```javascript
logger.logChunk(uploadId, 5, 10, userId);
// Output: Chunk 5/10 received for upload abc123 - User: xyz789
```

## Request Logging Middleware

The application includes automatic request logging via middleware:

```javascript
// In server/index.js
const { requestLogger, errorLogger } = require("./middleware/requestLogger");

app.use(requestLogger); // Logs all requests
// ... routes ...
app.use(errorLogger); // Logs all errors
```

Request logs include:

- HTTP method and URL
- Response status code
- Response time in milliseconds
- User ID (if authenticated)
- IP address

## Log Format

### Console Format (Development)

```
2025-12-03 10:30:45 info: Server running on http://0.0.0.0:8080
2025-12-03 10:30:50 http: POST /api/files/upload - 200 - 145ms - User: 123abc
2025-12-03 10:31:00 error: Error uploading file: Invalid file type
```

### File Format (JSON)

```json
{
  "level": "error",
  "message": "Error uploading file: Invalid file type",
  "timestamp": "2025-12-03 10:31:00",
  "stack": "Error: Invalid file type\n    at uploadFile (...)"
}
```

## Environment Configuration

The logger automatically adjusts based on `NODE_ENV`:

- **Development**: Log level set to `debug` (all logs)
- **Production**: Log level set to `info` (info, warn, error only)

## Log Rotation

Logs are automatically rotated:

- Daily rotation based on date
- Maximum file size: 20MB
- Retention period: 14 days
- Old logs are automatically cleaned up

## Implementation Locations

### Logger Configuration

- `server/utils/logger.js` - Main logger configuration

### Middleware

- `server/middleware/requestLogger.js` - HTTP request/error logging

### Usage Throughout Application

- `server/index.js` - Server startup and MongoDB connection
- `server/routes/*.js` - All route handlers
- `server/utils/*.js` - Utility functions
- `server/config/*.js` - Configuration files

## Migration from console.log

All `console.log`, `console.error`, `console.warn`, and `console.info` statements have been replaced with appropriate logger calls:

| Old                           | New                             |
| ----------------------------- | ------------------------------- |
| `console.log('message')`      | `logger.info('message')`        |
| `console.error('error', err)` | `logger.logError(err, 'error')` |
| `console.warn('warning')`     | `logger.warn('warning')`        |
| `console.info('info')`        | `logger.info('info')`           |
| `console.debug('debug')`      | `logger.debug('debug')`         |

## Benefits

1. **Structured Logging**: JSON format for easy parsing and analysis
2. **Log Rotation**: Automatic file rotation prevents disk space issues
3. **Multiple Transports**: Console for dev, files for production
4. **Context-Rich**: Includes timestamps, user IDs, request details
5. **Error Tracking**: Automatic stack trace logging
6. **Performance**: Minimal overhead with efficient file streaming
7. **Searchable**: Easy to search and filter logs by level, date, or content

## Viewing Logs

### Development

Watch logs in real-time via console output with color coding.

### Production

```bash
# View all logs
tail -f server/logs/combined-2025-12-03.log

# View only errors
tail -f server/logs/error-2025-12-03.log

# Search for specific user activity
grep "User: 123abc" server/logs/combined-*.log

# View logs from specific date
cat server/logs/combined-2025-12-03.log | grep "upload"
```

## Best Practices

1. **Use Appropriate Log Levels**

   - `error`: Actual errors that need attention
   - `warn`: Potential issues or deprecation notices
   - `info`: Important business logic events
   - `http`: Request/response logging (automatic)
   - `debug`: Detailed debugging (development only)

2. **Include Context**

   - Always include user IDs for tracking
   - Include file names, operation types
   - Add relevant metadata

3. **Don't Log Sensitive Data**

   - Never log passwords, tokens, or API keys
   - Be careful with PII (Personally Identifiable Information)
   - Sanitize error messages

4. **Use Helper Methods**
   - Prefer `logger.logError(err, context)` over `logger.error(err.message)`
   - Use specialized helpers for consistency

## Troubleshooting

### Logs Not Appearing

1. Check `logs/` directory exists in server folder
2. Verify write permissions on logs directory
3. Check disk space availability

### Performance Issues

1. Reduce log level in production (set to 'info' or 'warn')
2. Decrease log retention period if disk space is limited
3. Use log rotation settings to control file sizes

### Log Analysis

Consider integrating with log management tools:

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- New Relic
- Papertrail
