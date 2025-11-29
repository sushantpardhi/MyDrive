# API Reference

## Base URL

```
Development: http://localhost:8080/api
Production: https://your-domain.com/api
```

## Authentication

All API endpoints (except registration and login) require JWT authentication.

**Header Format**:

```
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success Response

```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Status Codes

- `200` - OK (Success)
- `201` - Created
- `400` - Bad Request (Invalid input)
- `401` - Unauthorized (Invalid/missing token)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `409` - Conflict (Duplicate resource)
- `413` - Payload Too Large
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "storageUsed": 0,
    "storageLimit": 5368709120
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "storageUsed": 1048576,
    "storageLimit": 5368709120
  }
}
```

### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

**Response (200)**:

```json
{
  "message": "Password reset email sent"
}
```

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "newpassword123"
}
```

**Response (200)**:

```json
{
  "message": "Password reset successful"
}
```

### Get Current User

```http
GET /api/auth/user
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "storageUsed": 1048576,
  "storageLimit": 5368709120,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

## File Endpoints

### Upload File (Standard)

```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary_data>
folderId: "parent_folder_id" (or "root")
```

**Response (201)**:

```json
{
  "file": {
    "id": "file_id",
    "name": "document.pdf",
    "originalName": "document.pdf",
    "size": 1048576,
    "type": "application/pdf",
    "path": "uploads/user_id/uuid-document.pdf",
    "owner": "user_id",
    "parent": "folder_id",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Initialize Chunked Upload

```http
POST /api/files/chunked-upload/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "fileName": "large-video.mp4",
  "fileSize": 104857600,
  "fileType": "video/mp4",
  "totalChunks": 100,
  "folderId": "folder_id"
}
```

**Response (200)**:

```json
{
  "uploadId": "upload_session_id",
  "chunkSize": 1048576
}
```

### Upload Chunk

```http
POST /api/files/chunked-upload/:uploadId/chunk
Authorization: Bearer <token>
Content-Type: multipart/form-data

chunk: <binary_data>
chunkIndex: "0"
checksum: "sha256_hash"
```

**Response (200)**:

```json
{
  "success": true,
  "chunkIndex": 0,
  "uploadedChunks": 1,
  "totalChunks": 100
}
```

### Complete Chunked Upload

```http
POST /api/files/chunked-upload/:uploadId/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "totalChunks": 100
}
```

**Response (200)**:

```json
{
  "file": {
    "id": "file_id",
    "name": "large-video.mp4",
    "size": 104857600,
    "uploadMetadata": {
      "method": "chunked",
      "totalChunks": 100,
      "uploadDuration": 45000
    }
  }
}
```

### Download File

```http
GET /api/files/:fileId/download
Authorization: Bearer <token>
```

**Response (200)**: File stream

### Update File

```http
PUT /api/files/:fileId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "new-filename.pdf",
  "parent": "new_folder_id"
}
```

**Response (200)**:

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

### Delete File

```http
DELETE /api/files/:fileId?permanent=false
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "message": "File moved to trash"
}
```

---

## Folder Endpoints

### Create Folder

```http
POST /api/folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Documents",
  "parent": "parent_folder_id"
}
```

**Response (201)**:

```json
{
  "folder": {
    "id": "folder_id",
    "name": "My Documents",
    "parent": "parent_folder_id",
    "owner": "user_id",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Get Folder Contents

```http
GET /api/folders/:folderId?page=1&limit=50&trash=false&sort=name&order=asc
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "folders": [...],
  "files": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 150
  },
  "path": [
    { "id": "root", "name": "My Drive" },
    { "id": "folder_id", "name": "Documents" }
  ]
}
```

### Update Folder

```http
PUT /api/folders/:folderId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Renamed Folder",
  "parent": "new_parent_id"
}
```

**Response (200)**:

```json
{
  "folder": {
    "id": "folder_id",
    "name": "Renamed Folder",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Delete Folder

```http
DELETE /api/folders/:folderId?permanent=false
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "message": "Folder moved to trash"
}
```

### Get Trash

```http
GET /api/folders/trash
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "folders": [...],
  "files": [...]
}
```

### Empty Trash

```http
POST /api/folders/trash/empty
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "message": "Trash emptied",
  "deletedFiles": 42,
  "deletedFolders": 5,
  "freedSpace": 104857600
}
```

---

## Sharing Endpoints

### Share Item

```http
POST /api/shared/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "file_or_folder_id",
  "itemType": "file",
  "shareWith": "recipient@example.com",
  "permission": "view"
}
```

**Response (200)**:

```json
{
  "message": "Item shared successfully",
  "share": {
    "id": "share_id",
    "itemId": "file_id",
    "permission": "view",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Get Shared Items

```http
GET /api/shared?type=file&page=1&limit=50
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "shared": [
    {
      "id": "share_id",
      "item": {...},
      "owner": {...},
      "permission": "view"
    }
  ],
  "pagination": {...}
}
```

### Remove Share

```http
DELETE /api/shared/:shareId
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "message": "Share access removed"
}
```

### Update Share Permission

```http
PUT /api/shared/:shareId
Authorization: Bearer <token>
Content-Type: application/json

{
  "permission": "edit"
}
```

**Response (200)**:

```json
{
  "share": {
    "id": "share_id",
    "permission": "edit"
  }
}
```

---

## User Endpoints

### Get User Profile

```http
GET /api/users/profile
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "storageUsed": 1048576,
  "storageLimit": 5368709120,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### Update User Profile

```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

**Response (200)**:

```json
{
  "user": {
    "id": "user_id",
    "name": "John Smith",
    "email": "john.smith@example.com"
  }
}
```

### Get Storage Stats

```http
GET /api/users/storage
Authorization: Bearer <token>
```

**Response (200)**:

```json
{
  "storageUsed": 1073741824,
  "storageLimit": 5368709120,
  "percentage": 20,
  "filesCount": 42,
  "foldersCount": 8
}
```

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

- **Authentication**: 5 requests per minute
- **File Upload**: 10 requests per minute
- **General API**: 100 requests per minute

**Rate Limit Headers**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Pagination

Endpoints that return lists support pagination:

**Parameters**:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response**:

```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 250,
    "itemsPerPage": 50,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## Error Codes

| Code                  | Description                        |
| --------------------- | ---------------------------------- |
| `INVALID_CREDENTIALS` | Email or password incorrect        |
| `EMAIL_EXISTS`        | Email already registered           |
| `TOKEN_EXPIRED`       | JWT token expired                  |
| `TOKEN_INVALID`       | JWT token invalid                  |
| `FILE_NOT_FOUND`      | File not found or access denied    |
| `FOLDER_NOT_FOUND`    | Folder not found or access denied  |
| `STORAGE_EXCEEDED`    | Storage limit exceeded             |
| `INVALID_FILE_TYPE`   | File type not allowed              |
| `PERMISSION_DENIED`   | Insufficient permissions           |
| `DUPLICATE_NAME`      | File/folder name already exists    |
| `CIRCULAR_REFERENCE`  | Cannot move folder into itself     |
| `SESSION_NOT_FOUND`   | Upload session not found           |
| `CHECKSUM_MISMATCH`   | Chunk checksum verification failed |

---

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install axios
```

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Upload file
const formData = new FormData();
formData.append("file", fileObject);
formData.append("folderId", "root");

await api.post("/files/upload", formData);
```

### cURL Examples

See individual endpoint sections above.

---

## Webhooks (Future Enhancement)

Not yet implemented, but planned for future releases:

- File uploaded webhook
- File shared webhook
- Storage warning webhook

## Related Documentation

- [Authentication](./AUTHENTICATION.md)
- [File Management](./FILE_MANAGEMENT.md)
- [Folder Management](./FOLDER_MANAGEMENT.md)
- [File Sharing](./FILE_SHARING.md)
