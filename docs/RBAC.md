# Role-Based Access Control (RBAC) Documentation

## Overview

MyDrive implements a role-based access control system with three distinct user roles: **Admin**, **Family**, and **Guest**. Each role has different storage limits and permissions.

## Roles and Storage Limits

### Admin

- **Storage Limit**: Unlimited (represented as `-1` in the database)
- **Permissions**: Full system access, can manage other users' roles
- **Purpose**: System administrators with complete control

### Family

- **Storage Limit**: Unlimited (represented as `-1` in the database)
- **Permissions**: Standard user permissions with unlimited storage
- **Purpose**: Trusted family members with unlimited storage access

### Guest

- **Storage Limit**: 5 GB
- **Permissions**: Standard user permissions with limited storage
- **Purpose**: Default role for new users with storage constraints

## Database Schema

### User Model Updates

```javascript
{
  role: {
    type: String,
    enum: ["admin", "family", "guest"],
    default: "guest",
  },
  storageLimit: {
    type: Number,
    default: 5 * 1024 * 1024 * 1024, // 5GB in bytes
    // -1 represents unlimited storage for admin/family
  }
}
```

### Pre-save Hook

The User model includes a pre-save hook that automatically sets the `storageLimit` based on the user's role:

```javascript
UserSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("role")) {
    const limit = ROLE_STORAGE_LIMITS[this.role];
    if (limit !== undefined) {
      this.storageLimit = limit;
    }
  }
  next();
});
```

## API Endpoints

### Authentication Endpoints

#### Register with Role

**POST** `/api/auth/register`

Request body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "guest" // Optional: "admin", "family", or "guest" (default: "guest")
}
```

Response:

```json
{
  "message": "User registered successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "guest",
    "storageLimit": 5368709120,
    "storageUsed": 0
  }
}
```

#### Login

**POST** `/api/auth/login`

Response now includes role information:

```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "guest",
    "storageLimit": 5368709120,
    "storageUsed": 1024000
  }
}
```

### User Management Endpoints (Admin Only)

#### Get All Users

**GET** `/api/users/all`

**Authentication**: Required (Admin role)

Response:

```json
[
  {
    "_id": "user_id_1",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "storageUsed": 1024000000,
    "storageLimit": -1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "_id": "user_id_2",
    "name": "Guest User",
    "email": "guest@example.com",
    "role": "guest",
    "storageUsed": 512000000,
    "storageLimit": 5368709120,
    "createdAt": "2024-01-02T00:00:00.000Z"
  }
]
```

#### Update User Role

**PUT** `/api/users/:userId/role`

**Authentication**: Required (Admin role)

Request body:

```json
{
  "role": "family" // "admin", "family", or "guest"
}
```

Response:

```json
{
  "message": "User role updated successfully",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "family",
    "storageLimit": -1,
    "storageUsed": 512000000,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Restrictions**:

- Admins cannot change their own role
- Only valid roles are accepted: "admin", "family", "guest"

#### Get User Details

**GET** `/api/users/:userId`

**Authentication**: Required (Admin role)

Response:

```json
{
  "_id": "user_id",
  "name": "User Name",
  "email": "user@example.com",
  "role": "family",
  "storageLimit": -1,
  "storageUsed": 1024000000,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "settings": {
    "emailNotifications": true,
    "language": "en",
    "theme": "light"
  },
  "preferences": {
    "viewMode": "list",
    "itemsPerPage": 25
  }
}
```

### Storage Information

#### Get Storage Stats

**GET** `/api/users/storage`

**Authentication**: Required

Response for Guest users:

```json
{
  "used": 1024000000,
  "limit": 5368709120,
  "remaining": 4344709120,
  "percentage": 19.1,
  "formattedUsed": "976.56 MB",
  "formattedLimit": "5.00 GB",
  "formattedRemaining": "4.05 GB",
  "isUnlimited": false,
  "role": "guest"
}
```

Response for Admin/Family users:

```json
{
  "used": 10737418240,
  "limit": -1,
  "remaining": -1,
  "percentage": 0,
  "formattedUsed": "10.00 GB",
  "formattedLimit": "Unlimited",
  "formattedRemaining": "Unlimited",
  "isUnlimited": true,
  "role": "admin"
}
```

## Middleware

### Role Authorization Middleware

Located at: `server/middleware/roleAuth.js`

#### `requireRole(roles)`

Checks if the authenticated user has one of the required roles.

```javascript
const { requireRole } = require("../middleware/roleAuth");

// Single role
router.get("/admin-only", requireRole("admin"), (req, res) => {
  // Admin-only endpoint
});

// Multiple roles
router.get("/premium-users", requireRole(["admin", "family"]), (req, res) => {
  // Admin and Family users only
});
```

#### `requireAdmin`

Shortcut for requiring admin role.

```javascript
const { requireAdmin } = require("../middleware/roleAuth");

router.put("/users/:id/role", requireAdmin, (req, res) => {
  // Admin-only endpoint
});
```

#### `requireAdminOrFamily`

Shortcut for requiring admin or family role.

```javascript
const { requireAdminOrFamily } = require("../middleware/roleAuth");

router.get("/unlimited-features", requireAdminOrFamily, (req, res) => {
  // Admin and Family users only
});
```

## Storage Validation

### Upload Validation Flow

1. **Storage Check**: Before any file upload, the system checks available storage
2. **Unlimited Storage**: Admin and Family users bypass storage limits
3. **Guest Users**: Validated against 5GB limit
4. **Rejection**: Upload rejected if guest user exceeds limit

### Storage Helper Functions

Located at: `server/utils/storageHelpers.js`

#### `checkStorageAvailability(user, fileSize)`

```javascript
// For Admin/Family users
{
  hasSpace: true,
  currentUsage: 10737418240,
  newUsage: 10847418240,
  limit: -1,
  percentage: 0,
  remainingSpace: -1,
  isUnlimited: true
}

// For Guest users
{
  hasSpace: true,
  currentUsage: 1024000000,
  newUsage: 1034000000,
  limit: 5368709120,
  percentage: 19.1,
  remainingSpace: 4344709120,
  isUnlimited: false
}
```

#### `validateStorageForUpload(user, fileSize)`

Returns `null` if upload is allowed, or error object if rejected:

```javascript
{
  error: "Storage limit exceeded",
  message: "You have exceeded your storage limit...",
  code: "STORAGE_LIMIT_EXCEEDED",
  details: {
    currentUsage: 5400000000,
    limit: 5368709120,
    percentage: 100.6,
    formattedUsed: "5.03 GB",
    formattedLimit: "5.00 GB",
    remainingSpace: -31290880,
    formattedRemaining: "-29.84 MB"
  }
}
```

### Storage Notifications

- **Disabled for Admin/Family**: No storage warnings sent to unlimited users
- **Guest Users**: Receive notifications at 50%, 75%, 90%, and 100% thresholds

## Client-Side Integration

### AuthContext Updates

New helper methods added to AuthContext:

```javascript
import { useAuth } from "../contexts";

function MyComponent() {
  const { user, isAdmin, isFamily, isGuest, hasUnlimitedStorage } = useAuth();

  return (
    <div>
      <p>Role: {user.role}</p>
      {isAdmin() && <AdminPanel />}
      {hasUnlimitedStorage() && <p>You have unlimited storage!</p>}
    </div>
  );
}
```

### Storage Display

The Sidebar component now handles unlimited storage display:

```javascript
// Unlimited storage
"10.00 GB used (Unlimited)";

// Limited storage
"976.56 MB of 5.00 GB used";
```

Storage bar is hidden for unlimited storage users.

### User Profile

The UserProfile component displays the user's role with color-coded badges:

- **Admin**: Gold color
- **Family**: Green color
- **Guest**: White color

## Security Considerations

1. **JWT Tokens**: Include role in JWT payload for efficient authorization
2. **Admin Self-Modification**: Admins cannot change their own role to prevent lockout
3. **Role Validation**: Server-side validation of all role changes
4. **Default Role**: New users default to "guest" role for security
5. **Middleware Protection**: All role-sensitive endpoints protected by middleware

## Migration Guide

### Existing Users

Existing users without a role field will:

1. Default to "guest" role
2. Maintain their current `storageLimit` (default 5GB)
3. Receive role assignment on next profile update

### Database Migration (Optional)

To set all existing users to a specific role:

```javascript
// Set all existing users to guest role
await User.updateMany(
  { role: { $exists: false } },
  { $set: { role: "guest", storageLimit: 5 * 1024 * 1024 * 1024 } }
);

// Promote specific users to admin
await User.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin", storageLimit: -1 } }
);
```

## Error Handling

### Common Error Codes

- `AUTH_REQUIRED`: No authentication token provided
- `INSUFFICIENT_PERMISSIONS`: User lacks required role
- `STORAGE_LIMIT_EXCEEDED`: Guest user exceeded 5GB limit
- `INVALID_ROLE`: Invalid role provided in request
- `CANNOT_MODIFY_OWN_ROLE`: Admin attempted to change own role

### Error Response Format

```json
{
  "error": "Insufficient permissions",
  "message": "This action requires one of the following roles: admin",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

## Logging

All role-related operations are logged:

```javascript
// Role change
logger.info("User role updated by admin", {
  adminId: "admin_user_id",
  targetUserId: "target_user_id",
  oldRole: "guest",
  newRole: "family",
  newStorageLimit: -1,
});

// Authorization failure
logger.warn("Role authorization failed", {
  userId: "user_id",
  userRole: "guest",
  requiredRoles: ["admin"],
  ip: "192.168.1.1",
  path: "/api/users/all",
});
```

## Best Practices

1. **Use Middleware**: Always protect admin endpoints with `requireAdmin`
2. **Check Role Client-Side**: Use AuthContext helpers for UI conditional rendering
3. **Validate Server-Side**: Never trust client-side role checks alone
4. **Log Changes**: Always log role modifications for audit trail
5. **Handle Unlimited Storage**: Check for `-1` or `isUnlimited` flag
6. **Update JWT**: Ensure role changes require re-authentication for updated token

## Future Enhancements

Potential improvements to consider:

1. **Custom Roles**: Allow creation of custom roles with specific permissions
2. **Role Hierarchy**: Implement permission inheritance
3. **Temporary Roles**: Time-limited role assignments
4. **Role History**: Track role change history per user
5. **Bulk Operations**: Admin tools for bulk role assignments
6. **Role-based Features**: Enable/disable features based on role
7. **Storage Quotas**: Configurable storage limits per role
