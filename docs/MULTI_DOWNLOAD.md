# Multi-File/Folder Download Feature

## Overview

Production-grade implementation for downloading multiple files and folders as a single ZIP archive. The solution uses streaming ZIP generation for memory efficiency and supports large datasets (GBs).

## Architecture

### Backend Components

#### 1. **ZIP Stream Service** (`server/utils/zipStreamService.js`)
- **Purpose**: Core streaming ZIP creation utility
- **Key Features**:
  - On-the-fly ZIP generation (no temp files)
  - Memory-efficient streaming using `archiver` library
  - Recursive directory traversal
  - Directory structure preservation
  - Client disconnect handling
  - Progress tracking support
  - Configurable compression levels

**Main Methods**:
- `createZipStream(res, zipName, options)` - Initialize ZIP stream
- `addFileToZip(archive, filePath, zipPath)` - Add single file
- `addMultipleFilesToZip(archive, files)` - Add multiple files
- `addDirectoryToZip(archive, dirPath, zipBasePath)` - Add directory recursively
- `finalizeZip(archive)` - Complete and close ZIP
- `handleClientDisconnect(req, archive, cleanupFn)` - Handle disconnects
- `calculateTotalSize(filePaths)` - Calculate total size for progress

#### 2. **Storage Abstraction Layer** (`server/utils/storageProvider.js`)
- **Purpose**: Abstract storage operations for local FS and S3
- **Key Features**:
  - Unified interface for different storage backends
  - Easy migration to cloud storage (S3, MinIO, etc.)
  - Stream-based file access
  - File metadata retrieval

**Supported Storage Types**:
- Local filesystem (active)
- AWS S3 (ready for implementation)

#### 3. **Download Helpers** (`server/utils/downloadHelpers.js`)
- **Purpose**: Business logic for download operations
- **Key Features**:
  - Permission validation (ownership and sharing)
  - Recursive folder file resolution
  - Mixed selection handling (files + folders)
  - File deduplication
  - Size limit enforcement
  - Smart ZIP filename generation

**Main Methods**:
- `validateFileAccess(fileId, userId)` - Check file permissions
- `validateFolderAccess(folderId, userId)` - Check folder permissions
- `getFolderFilesRecursive(folderId, userId, basePath)` - Recursively get all files
- `resolveDownloadSelection(fileIds, folderIds, userId)` - Resolve mixed selection
- `generateZipFilename(fileIds, folderIds, folderNames)` - Generate appropriate name
- `checkSizeLimit(totalSize, maxSize)` - Validate size constraints

#### 4. **Download Endpoint** (`server/routes/files.js`)
- **Route**: `POST /files/download`
- **Authentication**: Required (JWT)
- **Request Body**:
  ```json
  {
    "files": ["fileId1", "fileId2"],
    "folders": ["folderId1", "folderId2"]
  }
  ```

**Validation**:
- At least one file or folder must be selected
- Maximum 1000 items per download
- Total size must not exceed configured limit (default 5GB)

**Process Flow**:
1. Validate request body
2. Check authentication
3. Resolve all files from selection (recursive for folders)
4. Validate permissions for each file
5. Check size limits
6. Create ZIP stream
7. Add all files to ZIP
8. Stream ZIP to client
9. Log download activity

**Configuration**:
- `MAX_DOWNLOAD_SIZE` - Maximum download size in bytes (default: 5GB)
- `DOWNLOAD_TIMEOUT` - Request timeout in milliseconds (default: 30 minutes)

### Frontend Components

#### 1. **API Service** (`client/src/services/api.js`)
- **Method**: `downloadMultiple(fileIds, folderIds)`
- **Request**: POST to `/files/download`
- **Response**: Binary blob (ZIP file)
- **Timeout**: 30 minutes

#### 2. **Selection Hook** (`client/src/hooks/useSelection.js`)
- **Enhanced**: `bulkDownload()` method
- **Features**:
  - Single file: Use existing download flow
  - Multiple items: Use new ZIP download with progress tracking
  - Transfer context integration
  - Smart filename generation
  - XMLHttpRequest for progress tracking

#### 3. **Helper Utilities** (`client/src/utils/helpers.js`)
- **New Function**: `downloadMultiple()`
- **Purpose**: Reusable multi-download with progress callbacks
- **Callbacks**:
  - `onZipping` - Zipping phase started
  - `onProgress` - Download progress update
  - `onComplete` - Download completed/failed
  - `onCancel` - Download cancelled

#### 4. **Transfer Context** (`client/src/contexts/TransferContext.js`)
- **Already Integrated**: Download progress tracking
- **Methods Used**:
  - `startDownload(downloadId, fileName, fileSize, totalFiles)`
  - `updateZippingProgress(downloadId, filesProcessed, totalFiles)`
  - `updateDownloadProgress(downloadId, loadedBytes, totalBytes, speed)`
  - `completeDownload(downloadId, success)`
  - `failDownload(downloadId)`
  - `cancelDownload(downloadId)`

## Usage

### Backend Usage

```javascript
// Direct usage of ZIP service (for custom implementations)
const ZipStreamService = require('./utils/zipStreamService');
const archive = ZipStreamService.createZipStream(res, 'myfiles.zip');

// Add files
await ZipStreamService.addFileToZip(archive, '/path/to/file.txt', 'file.txt');

// Add directory
await ZipStreamService.addDirectoryToZip(archive, '/path/to/folder', 'folder');

// Finalize
await ZipStreamService.finalizeZip(archive);
```

### Frontend Usage

#### Using Selection Hook (Automatic)
```javascript
const { bulkDownload } = useSelection(api, folders, files, type);

// Select items first using selection context
// Then call:
await bulkDownload();
// Progress automatically tracked in transfer toast
```

#### Using Helper Function (Manual)
```javascript
import { downloadMultiple } from '../utils/helpers';

await downloadMultiple(
  api,
  ['fileId1', 'fileId2'], // File IDs
  ['folderId1'], // Folder IDs
  'my-archive.zip', // Filename
  {
    onZipping: (processed, total) => {
      console.log(`Zipping: ${processed}/${total}`);
    },
    onProgress: (loaded, total, speed) => {
      console.log(`Progress: ${loaded}/${total} bytes @ ${speed} B/s`);
    },
    onComplete: (success) => {
      console.log(`Complete: ${success}`);
    },
    onCancel: () => {
      console.log('Cancelled');
    }
  }
);
```

## Security Features

### Backend Security
1. **Authentication**: JWT token required
2. **Authorization**: 
   - Ownership check for each file/folder
   - Shared access validation
   - Trash items excluded
3. **Input Validation**: express-validator for request body
4. **Rate Limiting**: Applied via app-level middleware
5. **Path Traversal Protection**: File paths validated
6. **Size Limits**: Configurable max download size
7. **Item Limits**: Max 1000 items per download
8. **Timeout Protection**: Configurable timeout

### Frontend Security
1. **Token Management**: Automatic token injection
2. **CORS**: Configured via backend
3. **XSS Protection**: File names sanitized
4. **Timeout Handling**: 30-minute timeout with user feedback

## Performance Optimizations

### Memory Efficiency
- **Streaming**: Files streamed directly to ZIP (not loaded into memory)
- **No Temp Files**: ZIP generated on-the-fly
- **Chunked Transfer**: HTTP chunked encoding for large ZIPs
- **Stream Pooling**: Reuse file streams where possible

### Scalability
- **Stateless**: No server-side session state
- **Horizontal Scaling**: Safe behind load balancers
- **Resource Cleanup**: Automatic cleanup on errors/disconnects
- **Compression**: Adjustable compression levels (default: 6)

### Network Optimization
- **Resume Support**: Not yet implemented (future enhancement)
- **Progress Tracking**: Real-time progress updates
- **Client Disconnect Handling**: Aborts server-side processing
- **Timeout Management**: Prevents hung connections

## Error Handling

### Backend Errors
- **404**: File/folder not found
- **403**: Access denied (permission check failed)
- **400**: Invalid request (validation errors)
- **413**: Payload too large (size limit exceeded)
- **500**: Server error (logged with details)

### Frontend Errors
- **Network Errors**: Toast notification + log
- **Timeout**: 30-minute timeout with notification
- **Abort**: Clean cancellation with notification
- **Permission**: Error from backend displayed

## Logging

### Backend Logging
All operations logged with context:
- User ID
- File/folder IDs
- IP address
- Duration
- Size
- Success/failure
- Error details

**Log Levels**:
- `info`: Successful operations
- `warn`: Access denied, missing files, oversized requests
- `error`: Server errors, stream failures

### Frontend Logging
- Download start/complete
- Progress milestones
- Errors with context
- Cancellations

## Configuration

### Environment Variables

```bash
# Backend (.env)
MAX_DOWNLOAD_SIZE=5368709120  # 5GB in bytes
DOWNLOAD_TIMEOUT=1800000      # 30 minutes in ms
STORAGE_TYPE=local            # 'local' or 's3'
```

### Constants

```javascript
// Backend
const MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const DOWNLOAD_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Frontend
const DOWNLOAD_TIMEOUT = 30 * 60 * 1000; // 30 minutes
```

## Testing Recommendations

### Backend Tests
1. **Unit Tests**:
   - ZIP service methods
   - Download helpers
   - Permission validation
   - Size calculations

2. **Integration Tests**:
   - End-to-end download flow
   - Mixed file/folder selection
   - Permission edge cases
   - Size limit enforcement
   - Client disconnect handling

3. **Load Tests**:
   - Large file downloads (>1GB)
   - Many small files (>1000)
   - Concurrent downloads
   - Memory usage profiling

### Frontend Tests
1. **Unit Tests**:
   - Helper functions
   - Progress calculations

2. **Integration Tests**:
   - Selection + download flow
   - Progress tracking
   - Error handling
   - Cancellation

3. **E2E Tests**:
   - User selects and downloads
   - Progress toast visibility
   - Download completion
   - Error scenarios

## Future Enhancements

### Planned Features
1. **Resume Support**: Resume interrupted downloads
2. **Pre-signed URLs**: Generate temporary download URLs
3. **Async Jobs**: Queue large downloads for background processing
4. **Compression Options**: User-selectable compression levels
5. **Archive Formats**: Support TAR, RAR in addition to ZIP
6. **Email Notification**: Notify when large downloads are ready
7. **Download History**: Track download activity per user
8. **Bandwidth Throttling**: Limit download speed per user

### S3 Implementation
Current implementation has S3 support scaffolded but not active. To enable:

1. Install AWS SDK: `npm install aws-sdk`
2. Configure environment variables:
   ```bash
   STORAGE_TYPE=s3
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=us-east-1
   S3_BUCKET=your_bucket
   ```
3. Uncomment S3 methods in `storageProvider.js`
4. Update file paths to use S3 keys

## Troubleshooting

### Common Issues

**Issue**: ZIP download fails with timeout
- **Solution**: Increase `DOWNLOAD_TIMEOUT` or reduce selection size

**Issue**: Memory usage spikes during download
- **Solution**: Verify streaming is working (check for `.pipe()` usage)

**Issue**: ZIP file corrupted
- **Solution**: Check file permissions, verify file existence, check logs for errors

**Issue**: Progress not updating
- **Solution**: Verify XMLHttpRequest usage, check network tab for chunked encoding

**Issue**: Client disconnect not detected
- **Solution**: Verify `req.on('close')` handler is registered

## Code Locations

```
server/
├── routes/
│   └── files.js                  # POST /files/download endpoint
├── utils/
│   ├── zipStreamService.js       # ZIP streaming core
│   ├── storageProvider.js        # Storage abstraction
│   └── downloadHelpers.js        # Download business logic

client/
├── src/
│   ├── services/
│   │   └── api.js                # downloadMultiple() API method
│   ├── hooks/
│   │   └── useSelection.js       # Enhanced bulkDownload()
│   ├── utils/
│   │   └── helpers.js            # downloadMultiple() helper
│   └── contexts/
│       └── TransferContext.js    # Progress tracking (existing)
```

## Dependencies

### Backend
- `archiver@^7.0.1` - ZIP streaming
- `express-validator@^7.3.1` - Request validation
- `winston@^3.18.3` - Logging

### Frontend
- `axios` - HTTP client
- `react-toastify` - Notifications

## License

Part of MyDrive application.

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Maintainer**: Backend Engineering Team
