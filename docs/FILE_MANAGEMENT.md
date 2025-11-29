# File Management System

## Overview

MyDrive's file management system supports both standard and chunked file uploads, with features for download, rename, delete, and trash management.

## Features

- Standard file upload (< 5MB)
- Chunked file upload with resume capability (> 5MB)
- SHA-256 integrity verification
- File metadata management
- Trash and recovery system
- Storage quota tracking

## Upload Methods

### 1. Standard Upload

**Best for**: Files < 5MB

**Endpoint**: `POST /api/files/upload`

**Request**: `multipart/form-data`

```javascript
const formData = new FormData();
formData.append("file", fileObject);
formData.append("folderId", "parent_folder_id"); // or 'root'
```

**Response**:

```json
{
  "file": {
    "id": "file_id",
    "name": "document.pdf",
    "size": 1048576,
    "type": "application/pdf",
    "path": "uploads/user_id/uuid-document.pdf",
    "owner": "user_id",
    "parent": "folder_id",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 2. Chunked Upload

**Best for**: Files > 5MB, unreliable connections

**Process**:

1. **Initialize Upload**
2. **Upload Chunks**
3. **Complete Upload**

#### Step 1: Initialize

**Endpoint**: `POST /api/files/chunked-upload/init`

**Request**:

```json
{
  "fileName": "large-video.mp4",
  "fileSize": 104857600,
  "fileType": "video/mp4",
  "totalChunks": 100,
  "folderId": "folder_id"
}
```

**Response**:

```json
{
  "uploadId": "upload_session_id",
  "chunkSize": 1048576
}
```

#### Step 2: Upload Chunks

**Endpoint**: `POST /api/files/chunked-upload/:uploadId/chunk`

**Request**: `multipart/form-data`

```javascript
const formData = new FormData();
formData.append("chunk", chunkBlob);
formData.append("chunkIndex", "0");
formData.append("checksum", sha256Hash);
```

**Response**:

```json
{
  "success": true,
  "chunkIndex": 0,
  "uploadedChunks": 1,
  "totalChunks": 100
}
```

**Features**:

- SHA-256 checksum verification
- Automatic retry on failure (max 3 attempts)
- Duplicate chunk detection
- Progress tracking

#### Step 3: Complete Upload

**Endpoint**: `POST /api/files/chunked-upload/:uploadId/complete`

**Request**:

```json
{
  "totalChunks": 100
}
```

**Response**:

```json
{
  "file": {
    "id": "file_id",
    "name": "large-video.mp4",
    "size": 104857600,
    "type": "video/mp4",
    "uploadMetadata": {
      "uploadId": "upload_session_id",
      "totalChunks": 100,
      "uploadDuration": 45000,
      "totalRetries": 2,
      "method": "chunked"
    }
  }
}
```

## File Operations

### Download File

**Endpoint**: `GET /api/files/:fileId/download`

**Headers**:

```
Authorization: Bearer <token>
```

**Response**: File stream with headers:

```
Content-Type: <file_mime_type>
Content-Disposition: attachment; filename="<filename>"
Content-Length: <file_size>
```

### Update File Metadata

**Endpoint**: `PUT /api/files/:fileId`

**Request**:

```json
{
  "name": "new-filename.pdf",
  "parent": "new_folder_id"
}
```

**Response**:

```json
{
  "file": {
    "id": "file_id",
    "name": "new-filename.pdf",
    "parent": "new_folder_id",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Move to Trash

**Endpoint**: `DELETE /api/files/:fileId`

**Response**:

```json
{
  "message": "File moved to trash"
}
```

**Note**: File is soft-deleted (trash flag set to true), not permanently removed.

### Restore from Trash

**Endpoint**: `PUT /api/files/:fileId`

**Request**:

```json
{
  "trash": false
}
```

### Permanent Delete

**Endpoint**: `DELETE /api/files/:fileId?permanent=true`

**Response**:

```json
{
  "message": "File permanently deleted"
}
```

## Client Implementation

### File Upload Hook

Location: `client/src/hooks/useFileOperations.js`

```javascript
const { uploadFiles, deleteFiles, renameFile } = useFileOperations();

// Upload files
await uploadFiles(fileList, currentFolderId);

// Delete file
await deleteFiles(["file_id_1", "file_id_2"]);

// Rename file
await renameFile("file_id", "new-name.pdf");
```

### Chunked Upload Service

Location: `client/src/services/chunkedUpload.js`

```javascript
const upload = new ChunkedUploadService({
  file: fileObject,
  folderId: "parent_folder_id",
  onProgress: (loaded, total) => {
    const percentage = (loaded / total) * 100;
    console.log(`Upload progress: ${percentage}%`);
  },
  onChunkProgress: (chunkIndex, totalChunks) => {
    console.log(`Chunk ${chunkIndex + 1} of ${totalChunks}`);
  },
});

// Start upload
await upload.start();

// Pause upload
await upload.pause();

// Resume upload
await upload.resume();

// Cancel upload
await upload.cancel();
```

### Upload Progress Tracking

Location: `client/src/hooks/useUploadProgress.js`

```javascript
const { uploads, cancelUpload, pauseUpload, resumeUpload } =
  useUploadProgress();

// Access upload state
uploads.forEach((upload) => {
  console.log(`${upload.name}: ${upload.progress}%`);
  console.log(`Status: ${upload.status}`); // 'uploading', 'paused', 'completed', 'error'
});
```

## Storage Management

### Storage Calculation

- Each user has a storage limit (default: 5GB)
- Storage is calculated on successful upload
- Storage is freed on permanent delete

### Storage Check Before Upload

```javascript
// Backend validation
if (user.storageUsed + fileSize > user.storageLimit) {
  return res.status(400).json({
    error: "Storage limit exceeded",
  });
}
```

### Get Storage Stats

**Endpoint**: `GET /api/users/storage`

**Response**:

```json
{
  "storageUsed": 1073741824,
  "storageLimit": 5368709120,
  "percentage": 20,
  "filesCount": 42
}
```

## File Structure

### Database Schema

```javascript
{
  name: String,
  originalName: String,
  size: Number,
  type: String,
  path: String,
  owner: ObjectId,
  parent: ObjectId, // null for root
  shared: [ObjectId],
  trash: Boolean,
  uploadMetadata: {
    uploadId: String,
    method: String, // 'standard' or 'chunked'
    totalChunks: Number,
    uploadDuration: Number,
    totalRetries: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### File Storage

```
server/uploads/
├── {userId}/
│   ├── {uuid}-filename1.pdf
│   ├── {uuid}-filename2.jpg
│   └── ...
├── temp/
│   └── {userId}/
│       └── {uploadId}/
│           ├── chunk_000000
│           ├── chunk_000001
│           └── ...
└── thumbnails/
    └── {userId}/
        ├── {fileId}-thumb.jpg
        └── ...
```

## Chunked Upload Technical Details

### Chunk Size Configuration

```env
# server/.env
CHUNK_SIZE=1048576        # 1MB default
MAX_CHUNK_SIZE=10485760   # 10MB max
```

### Chunk Processing

1. **File Splitting** (Client):

```javascript
const chunkSize = 1048576; // 1MB
const chunks = Math.ceil(file.size / chunkSize);

for (let i = 0; i < chunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const chunk = file.slice(start, end);

  // Generate SHA-256 checksum
  const checksum = await calculateSHA256(chunk);

  // Upload chunk
  await uploadChunk(chunk, i, checksum);
}
```

2. **Chunk Storage** (Server):

```javascript
// Store chunk in temp directory
const chunkPath = path.join(
  UPLOAD_DIR,
  "temp",
  userId,
  uploadId,
  `chunk_${chunkIndex.toString().padStart(6, "0")}`
);

await fs.promises.writeFile(chunkPath, chunkData);
```

3. **Chunk Assembly** (Server):

```javascript
// Combine all chunks into final file
const writeStream = fs.createWriteStream(finalPath);

for (let i = 0; i < totalChunks; i++) {
  const chunkPath = getChunkPath(uploadId, i);
  const chunkData = await fs.promises.readFile(chunkPath);
  writeStream.write(chunkData);
}

writeStream.end();
```

### Retry Logic

```javascript
const MAX_RETRIES = 3;
let retries = 0;

while (retries < MAX_RETRIES) {
  try {
    await uploadChunk(chunk, index);
    break; // Success
  } catch (error) {
    retries++;
    if (retries >= MAX_RETRIES) throw error;

    // Exponential backoff
    await sleep(Math.pow(2, retries) * 1000);
  }
}
```

## Upload Session Management

### Session Schema

```javascript
{
  uploadId: String,
  userId: ObjectId,
  fileName: String,
  fileSize: Number,
  totalChunks: Number,
  uploadedChunks: [Number],
  checksums: Map,
  status: String, // 'active', 'completed', 'failed'
  expiresAt: Date, // 24 hours from creation
  createdAt: Date
}
```

### Automatic Cleanup

- Upload sessions expire after 24 hours
- Cron job runs every hour to clean expired sessions
- Temp chunk files are deleted on cleanup

Location: `server/utils/cleanupScheduler.js`

## Error Handling

### Common Upload Errors

```javascript
// Storage exceeded
{ error: 'Storage limit exceeded', code: 'STORAGE_EXCEEDED' }

// Invalid file type
{ error: 'File type not allowed', code: 'INVALID_TYPE' }

// Upload session not found
{ error: 'Upload session not found', code: 'SESSION_NOT_FOUND' }

// Chunk verification failed
{ error: 'Chunk checksum mismatch', code: 'CHECKSUM_MISMATCH' }

// File size mismatch
{ error: 'File size does not match', code: 'SIZE_MISMATCH' }
```

## Performance Optimization

### Client-side

- Parallel chunk uploads (limit: 3 concurrent)
- Chunk size optimization based on connection speed
- Resume capability for interrupted uploads
- Local progress caching

### Server-side

- Stream-based file assembly (no memory loading)
- Temporary chunk storage cleanup
- Database indexing on owner and parent fields
- CDN integration for downloads (optional)

## Testing

### Test Standard Upload

```bash
curl -X POST http://localhost:8080/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "folderId=root"
```

### Test File Download

```bash
curl http://localhost:8080/api/files/FILE_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded-file.pdf
```

## Security Considerations

✅ File ownership validation on all operations  
✅ File type validation (configurable whitelist/blacklist)  
✅ Storage quota enforcement  
✅ SHA-256 checksum verification for chunked uploads  
✅ Temporary file cleanup  
✅ Path traversal prevention

## Related Documentation

- [Folder Management](./FOLDER_MANAGEMENT.md)
- [File Sharing](./FILE_SHARING.md)
- [Storage Management](./STORAGE_MANAGEMENT.md)
