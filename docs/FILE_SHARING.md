# File Sharing

## Overview

MyDrive allows users to share files and folders with other users via email, with configurable permissions and access control.

## Features

- Share files and folders with multiple users
- Email notifications on share
- Permission levels (view, edit)
- Revoke access anytime
- Track shared items
- Shared with me view

## API Endpoints

### 1. Share File/Folder

**Endpoint**: `POST /api/shared/share`

**Request**:

```json
{
  "itemId": "file_or_folder_id",
  "itemType": "file",
  "shareWith": "recipient@example.com",
  "permission": "view"
}
```

**Parameters**:

- `itemId` - ID of file or folder to share
- `itemType` - "file" or "folder"
- `shareWith` - Email address of recipient
- `permission` - "view" or "edit"

**Response**:

```json
{
  "message": "Item shared successfully",
  "share": {
    "id": "share_id",
    "itemId": "file_id",
    "itemType": "file",
    "owner": "owner_user_id",
    "sharedWith": "recipient_user_id",
    "permission": "view",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Email Notification**:

- Sends email to recipient with share details
- Includes link to view shared item
- Shows owner name and item name

### 2. Get Shared Items

**Endpoint**: `GET /api/shared`

**Query Parameters**:

- `type` - Filter by "file" or "folder"
- `page` - Page number
- `limit` - Items per page

**Response**:

```json
{
  "shared": [
    {
      "id": "share_id",
      "item": {
        "id": "file_id",
        "name": "document.pdf",
        "type": "application/pdf",
        "size": 1048576
      },
      "itemType": "file",
      "owner": {
        "id": "owner_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "permission": "view",
      "sharedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalItems": 15
  }
}
```

### 3. Remove Share Access

**Endpoint**: `DELETE /api/shared/:shareId`

**Response**:

```json
{
  "message": "Share access removed"
}
```

### 4. Update Share Permission

**Endpoint**: `PUT /api/shared/:shareId`

**Request**:

```json
{
  "permission": "edit"
}
```

**Response**:

```json
{
  "share": {
    "id": "share_id",
    "permission": "edit",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

## Permission Levels

### View Permission

Users can:

- ✅ View file/folder
- ✅ Download file
- ✅ View folder contents
- ❌ Edit or delete
- ❌ Share with others
- ❌ Move items

### Edit Permission

Users can:

- ✅ View file/folder
- ✅ Download file
- ✅ View folder contents
- ✅ Upload files to shared folder
- ✅ Rename items
- ❌ Delete items
- ❌ Share with others
- ❌ Move to different folder

### Owner Permission

Owner can:

- ✅ All edit permissions
- ✅ Delete items
- ✅ Share with others
- ✅ Change permissions
- ✅ Revoke access
- ✅ Move items

## Database Schema

### Share Model

```javascript
{
  itemId: ObjectId,
  itemType: String, // 'file' or 'folder'
  owner: ObjectId,
  sharedWith: ObjectId,
  permission: String, // 'view' or 'edit'
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
ShareSchema.index({ itemId: 1, sharedWith: 1 }, { unique: true });
ShareSchema.index({ sharedWith: 1 });
ShareSchema.index({ owner: 1 });
```

## Client Implementation

### Share Dialog Component

Location: `client/src/components/files/ShareDialog.jsx`

```javascript
const ShareDialog = ({ item, onClose }) => {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("view");

  const handleShare = async () => {
    await api.shareItem({
      itemId: item.id,
      itemType: item.type,
      shareWith: email,
      permission,
    });

    toast.success("Item shared successfully!");
    onClose();
  };

  return (
    <dialog>
      <h2>Share {item.name}</h2>

      <input
        type="email"
        placeholder="Enter email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <select
        value={permission}
        onChange={(e) => setPermission(e.target.value)}
      >
        <option value="view">Can view</option>
        <option value="edit">Can edit</option>
      </select>

      <button onClick={handleShare}>Share</button>
    </dialog>
  );
};
```

### Shared Items View

Location: `client/src/components/drive/SharedView.jsx`

```javascript
const SharedView = () => {
  const [sharedItems, setSharedItems] = useState([]);

  useEffect(() => {
    loadSharedItems();
  }, []);

  const loadSharedItems = async () => {
    const response = await api.getSharedItems();
    setSharedItems(response.shared);
  };

  return (
    <div>
      <h1>Shared with me</h1>
      {sharedItems.map((share) => (
        <FileCard
          key={share.id}
          file={share.item}
          owner={share.owner}
          permission={share.permission}
        />
      ))}
    </div>
  );
};
```

## Access Control

### Backend Middleware

```javascript
// Check if user has access to item
const checkAccess = async (req, res, next) => {
  const { itemId } = req.params;
  const userId = req.user.id;

  // Check ownership
  const item = await File.findById(itemId);
  if (item.owner.equals(userId)) {
    req.isOwner = true;
    return next();
  }

  // Check if shared
  const share = await Share.findOne({
    itemId,
    sharedWith: userId,
  });

  if (!share) {
    return res.status(403).json({
      error: "Access denied",
    });
  }

  req.permission = share.permission;
  req.isOwner = false;
  next();
};
```

### Permission Check

```javascript
// Check edit permission
const requireEditAccess = (req, res, next) => {
  if (req.isOwner || req.permission === "edit") {
    return next();
  }

  return res.status(403).json({
    error: "Edit permission required",
  });
};

// Usage
router.put("/files/:itemId", checkAccess, requireEditAccess, updateFile);
```

## Folder Sharing

### Recursive Permissions

When sharing a folder:

- All files in folder are accessible
- All subfolders are accessible
- Permission applies to all contents

```javascript
// Check folder access recursively
const checkFolderAccess = async (folderId, userId) => {
  // Check folder itself
  const folder = await Folder.findById(folderId);
  if (folder.owner.equals(userId)) return true;

  // Check if folder is shared
  const share = await Share.findOne({
    itemId: folderId,
    sharedWith: userId,
  });

  if (share) return true;

  // Check parent folders recursively
  if (folder.parent) {
    return checkFolderAccess(folder.parent, userId);
  }

  return false;
};
```

## Email Notifications

### Share Notification Template

```html
Subject: {ownerName} shared "{itemName}" with you Hi {recipientName},
{ownerName} has shared a {itemType} with you on MyDrive. Item Details: • Name:
{itemName} • Type: {itemType} • Access: {permission} View Now:
{clientUrl}/shared If you don't have a MyDrive account, you'll need to create
one first. Best regards, The MyDrive Team
```

### Implementation

```javascript
// server/routes/shared.js
await emailService.sendFileSharedEmail(recipientEmail, recipientName, {
  itemName: item.name,
  itemType: itemType,
  ownerName: req.user.name,
  permission: permission === "view" ? "View only" : "Can edit",
});
```

## Security Considerations

### 1. Email Validation

```javascript
// Validate email before sharing
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
```

### 2. Prevent Self-Sharing

```javascript
if (shareWith === req.user.email) {
  return res.status(400).json({
    error: "Cannot share with yourself",
  });
}
```

### 3. Duplicate Share Prevention

```javascript
const existingShare = await Share.findOne({
  itemId,
  sharedWith: recipientId,
});

if (existingShare) {
  return res.status(409).json({
    error: "Already shared with this user",
  });
}
```

### 4. Owner Validation

```javascript
// Only owner can share
if (!item.owner.equals(req.user.id)) {
  return res.status(403).json({
    error: "Only owner can share",
  });
}
```

## Share Management

### List Shared Users

**Endpoint**: `GET /api/files/:fileId/shares`

**Response**:

```json
{
  "shares": [
    {
      "id": "share_id",
      "user": {
        "id": "user_id",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "permission": "view",
      "sharedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### Bulk Share

```javascript
// Share with multiple users
const shareWithMultiple = async (itemId, emails, permission) => {
  const shares = await Promise.all(
    emails.map((email) =>
      api.shareItem({ itemId, shareWith: email, permission })
    )
  );

  return shares;
};
```

## Public Link Sharing (Future Enhancement)

### Generate Public Link

```javascript
// Not implemented yet, but planned feature
const generatePublicLink = async (itemId) => {
  const token = crypto.randomBytes(32).toString("hex");

  await PublicLink.create({
    itemId,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return `${CLIENT_URL}/public/${token}`;
};
```

## Testing

### Test File Sharing

```bash
curl -X POST http://localhost:8080/api/shared/share \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "FILE_ID",
    "itemType": "file",
    "shareWith": "recipient@example.com",
    "permission": "view"
  }'
```

### Test Get Shared Items

```bash
curl http://localhost:8080/api/shared \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Remove Share

```bash
curl -X DELETE http://localhost:8080/api/shared/SHARE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Related Documentation

- [File Management](./FILE_MANAGEMENT.md)
- [Folder Management](./FOLDER_MANAGEMENT.md)
- [Email Service](./EMAIL_SERVICE.md)
- [Authentication](./AUTHENTICATION.md)
