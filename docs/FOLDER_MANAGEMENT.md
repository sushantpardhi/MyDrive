# Folder Management

## Overview

MyDrive's folder system provides hierarchical organization with support for nested folders, trash management, and folder sharing.

## Features

- Create nested folders
- Rename folders
- Move folders
- Delete folders (with trash)
- Folder navigation with breadcrumbs
- Pagination support
- Recursive folder operations

## API Endpoints

### 1. Create Folder

**Endpoint**: `POST /api/folders`

**Request**:

```json
{
  "name": "My Documents",
  "parent": "parent_folder_id"
}
```

**Response**:

```json
{
  "folder": {
    "id": "folder_id",
    "name": "My Documents",
    "parent": "parent_folder_id",
    "owner": "user_id",
    "trash": false,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Notes**:

- Use `parent: "root"` or `parent: null` for root-level folders
- Folder names must be unique within the same parent

### 2. Get Folder Contents

**Endpoint**: `GET /api/folders/:folderId`

**Query Parameters**:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `trash` - Show trash items (default: false)
- `sort` - Sort field (name, createdAt, size)
- `order` - Sort order (asc, desc)

**Example**:

```
GET /api/folders/folder_id?page=1&limit=50&trash=false&sort=name&order=asc
```

**Response**:

```json
{
  "folders": [
    {
      "id": "subfolder_id",
      "name": "Subfolder",
      "parent": "folder_id",
      "itemCount": 5,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "files": [
    {
      "id": "file_id",
      "name": "document.pdf",
      "size": 1048576,
      "type": "application/pdf",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 150,
    "itemsPerPage": 50
  },
  "path": [
    { "id": "root", "name": "My Drive" },
    { "id": "folder_id", "name": "Documents" }
  ]
}
```

### 3. Update Folder

**Endpoint**: `PUT /api/folders/:folderId`

**Request**:

```json
{
  "name": "Renamed Folder",
  "parent": "new_parent_id"
}
```

**Response**:

```json
{
  "folder": {
    "id": "folder_id",
    "name": "Renamed Folder",
    "parent": "new_parent_id",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Validation**:

- Cannot move folder into itself
- Cannot move folder into its own subfolder
- Cannot create circular references

### 4. Delete Folder (Move to Trash)

**Endpoint**: `DELETE /api/folders/:folderId`

**Response**:

```json
{
  "message": "Folder moved to trash"
}
```

**Notes**:

- Folder and all contents moved to trash
- Contents can be restored individually

### 5. Restore Folder from Trash

**Endpoint**: `PUT /api/folders/:folderId`

**Request**:

```json
{
  "trash": false
}
```

**Response**:

```json
{
  "message": "Folder restored from trash"
}
```

### 6. Permanent Delete

**Endpoint**: `DELETE /api/folders/:folderId?permanent=true`

**Response**:

```json
{
  "message": "Folder permanently deleted",
  "deletedFiles": 25,
  "deletedFolders": 3
}
```

**Warning**: This action cannot be undone!

## Folder Structure

### Database Schema

```javascript
{
  name: String,
  owner: ObjectId,
  parent: ObjectId, // null for root folders
  shared: [ObjectId],
  trash: Boolean,
  color: String, // Optional folder color
  description: String, // Optional description
  createdAt: Date,
  updatedAt: Date
}
```

### Root Folder Convention

- Root is represented as `parent: null` in database
- API returns `"root"` as parent ID for root folders
- Frontend uses `"root"` in navigation

```javascript
// Backend converts root
if (folder.parent === null) {
  folder.parent = "root";
}

// Backend converts back
if (req.body.parent === "root") {
  req.body.parent = null;
}
```

## Client Implementation

### Folder Navigation

Location: `client/src/contexts/DriveContext.js`

```javascript
const {
  currentFolderId,
  folders,
  files,
  navigateToFolder,
  loadFolderContents,
} = useDriveContext();

// Navigate to folder
await navigateToFolder("folder_id");

// Navigate to root
await navigateToFolder("root");

// Reload current folder
await loadFolderContents();
```

### Breadcrumb Navigation

Location: `client/src/hooks/useBreadcrumbs.js`

```javascript
const { breadcrumbs } = useBreadcrumbs(currentFolderId);

// Breadcrumbs array
[
  { id: "root", name: "My Drive" },
  { id: "folder1", name: "Documents" },
  { id: "folder2", name: "Projects" },
];
```

### Folder Operations Hook

Location: `client/src/hooks/useFileOperations.js`

```javascript
const { createFolder, renameFolder, deleteFolder, moveFolder } =
  useFileOperations();

// Create folder
await createFolder("New Folder", currentFolderId);

// Rename folder
await renameFolder("folder_id", "New Name");

// Delete folder
await deleteFolder(["folder_id_1", "folder_id_2"]);

// Move folder
await moveFolder("folder_id", "new_parent_id");
```

## Folder Features

### 1. Nested Folders

```
My Drive (root)
├── Documents
│   ├── Work
│   │   ├── Projects
│   │   └── Reports
│   └── Personal
├── Photos
│   ├── 2024
│   └── 2025
└── Videos
```

**Maximum Nesting**: No hard limit, but recommended max depth of 10 for performance

### 2. Folder Statistics

Each folder tracks:

- Total items count (files + subfolders)
- Total size (sum of all file sizes)
- Last modified date
- Number of shared items

**Get Folder Stats**:

```javascript
// Included in folder object
{
  "id": "folder_id",
  "name": "Documents",
  "itemCount": 42,
  "totalSize": 104857600,
  "sharedCount": 5,
  "lastModified": "2025-01-01T00:00:00.000Z"
}
```

### 3. Folder Colors

Optional visual organization:

**Available Colors**:

- Blue (default)
- Red
- Green
- Yellow
- Purple
- Orange
- Gray

**Set Folder Color**:

```javascript
await updateFolder("folder_id", { color: "red" });
```

### 4. Bulk Operations

```javascript
// Delete multiple folders
await deleteFolder(["folder1", "folder2", "folder3"]);

// Move multiple folders
await moveFolders(["folder1", "folder2"], "target_folder_id");
```

## Pagination & Sorting

### Client-side Pagination

```javascript
// Load next page
const loadMore = async () => {
  const nextPage = currentPage + 1;
  const response = await api.getFolderContents(currentFolderId, {
    page: nextPage,
    limit: 50,
  });

  // Append new items
  setFolders([...folders, ...response.folders]);
  setFiles([...files, ...response.files]);
};
```

### Infinite Scroll

Location: `client/src/hooks/useInfiniteScroll.js`

```javascript
const { hasMore, loading } = useInfiniteScroll({
  loadMore: async () => {
    await loadFolderContents(currentPage + 1);
  },
  threshold: 100, // pixels from bottom
});
```

### Sorting Options

```javascript
const sortOptions = [
  { value: "name:asc", label: "Name (A-Z)" },
  { value: "name:desc", label: "Name (Z-A)" },
  { value: "createdAt:desc", label: "Newest First" },
  { value: "createdAt:asc", label: "Oldest First" },
  { value: "size:desc", label: "Largest First" },
  { value: "size:asc", label: "Smallest First" },
];
```

## Search in Folders

### Search Current Folder

**Endpoint**: `GET /api/folders/:folderId/search`

**Query Parameters**:

- `q` - Search query
- `type` - Filter by type (file, folder, all)

```
GET /api/folders/folder_id/search?q=report&type=file
```

**Response**:

```json
{
  "results": [
    {
      "type": "file",
      "id": "file_id",
      "name": "Annual Report 2024.pdf",
      "path": ["Documents", "Work", "Reports"]
    }
  ],
  "total": 1
}
```

### Recursive Search

Location: `client/src/hooks/useSearch.js`

```javascript
const { search, results, searching, clearSearch } = useSearch();

// Search in current folder and subfolders
await search("keyword", { recursive: true });

// Filter results
const filteredResults = results.filter((r) => r.type === "file");
```

## Trash Management

### Trash Folder View

**Endpoint**: `GET /api/folders/trash`

**Response**:

```json
{
  "folders": [
    {
      "id": "folder_id",
      "name": "Old Folder",
      "deletedAt": "2025-01-01T00:00:00.000Z",
      "originalParent": "parent_folder_id"
    }
  ],
  "files": [
    {
      "id": "file_id",
      "name": "old-file.pdf",
      "deletedAt": "2025-01-01T00:00:00.000Z",
      "originalParent": "parent_folder_id"
    }
  ]
}
```

### Empty Trash

**Endpoint**: `POST /api/folders/trash/empty`

**Response**:

```json
{
  "message": "Trash emptied",
  "deletedFiles": 42,
  "deletedFolders": 5,
  "freedSpace": 104857600
}
```

### Auto-deletion

- Items in trash are kept for 30 days
- After 30 days, items are permanently deleted
- Scheduled job runs daily to clean old trash items

## Folder Permissions

### Ownership

- Only folder owner can:
  - Delete permanently
  - Change sharing settings
  - Move folder to different parent

### Shared Access

- Shared users can:
  - View folder contents
  - Add files (if permission granted)
  - Create subfolders (if permission granted)

**Check Permissions**:

```javascript
// Backend middleware
const canModify = (folder, userId) => {
  return (
    folder.owner.equals(userId) ||
    folder.shared.some(
      (share) => share.userId.equals(userId) && share.permission === "edit"
    )
  );
};
```

## Error Handling

### Common Errors

```javascript
// Folder not found
{ error: 'Folder not found', code: 'FOLDER_NOT_FOUND' }

// Duplicate name
{ error: 'Folder with this name already exists', code: 'DUPLICATE_NAME' }

// Circular reference
{ error: 'Cannot move folder into itself', code: 'CIRCULAR_REFERENCE' }

// Permission denied
{ error: 'You do not have permission', code: 'PERMISSION_DENIED' }

// Parent not found
{ error: 'Parent folder not found', code: 'PARENT_NOT_FOUND' }
```

## Performance Optimization

### Database Indexes

```javascript
FolderSchema.index({ owner: 1, parent: 1, trash: 1 });
FolderSchema.index({ owner: 1, name: 1 });
FolderSchema.index({ shared: 1 });
```

### Caching Strategy

- Cache folder structure in client state
- Invalidate cache on folder operations
- Use optimistic updates for better UX

### Lazy Loading

- Load folder contents on demand
- Don't load entire tree structure
- Pagination for large folders

## Testing

### Test Folder Creation

```bash
curl -X POST http://localhost:8080/api/folders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Folder","parent":"root"}'
```

### Test Folder Navigation

```bash
curl http://localhost:8080/api/folders/FOLDER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Folder Deletion

```bash
curl -X DELETE http://localhost:8080/api/folders/FOLDER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Related Documentation

- [File Management](./FILE_MANAGEMENT.md)
- [File Sharing](./FILE_SHARING.md)
- [Search](./SEARCH.md)
