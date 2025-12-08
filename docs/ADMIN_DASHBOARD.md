# Admin Dashboard Documentation

## Overview

The Admin Dashboard is a comprehensive administrative interface for MyDrive that allows administrators to manage users, monitor system activity, view storage reports, and manage files across the entire system.

## Features

### 1. Dashboard Overview (`/admin`)

- **System Statistics**: Real-time overview of users, files, storage, and folders
- **User Distribution**: Visual breakdown of users by role (Admin, Family, Guest)
- **Storage Analytics**: Total storage usage, average file size, largest files
- **File Type Distribution**: Top 10 file types with usage statistics
- **Quick Actions**: Easy navigation to all admin sections

### 2. User Management (`/admin/users`)

- **User List**: Paginated list of all users with search and filtering
- **Search**: Find users by name or email
- **Filter by Role**: View users by Admin, Family, or Guest role
- **Sort Options**: Sort by name, email, date created, or storage used
- **Role Management**: Change user roles with automatic storage limit updates
- **User Deletion**: Remove users and all their associated data
- **User Details**: View storage usage, file count, and recent activity

### 3. File Management (`/admin/files`)

- **File List**: Paginated list of all files in the system
- **Search**: Find files by filename
- **Filter by Type**: Filter by images, videos, PDFs, etc.
- **Owner Information**: See which user owns each file
- **File Deletion**: Admin override to delete any file
- **Storage Impact**: View file sizes and types

### 4. Storage Report (`/admin/storage`)

- **User Storage Cards**: Visual representation of each user's storage usage
- **Usage Percentage**: See how much of their limit users have consumed
- **Storage Warnings**: Automatic alerts for users approaching limits
- **Unlimited Storage**: Clear indication for Admin and Family users
- **Sorted by Usage**: Users ordered by storage consumption

### 5. Activity Log (`/admin/activity`)

- **Recent Uploads**: Latest file uploads with user information
- **User Registrations**: New user signups with role information
- **Timestamp Tracking**: All activities with formatted timestamps
- **Activity Icons**: Visual indicators for different activity types

## Access Control

### Role-Based Permissions

- **Admin Role Required**: All admin routes are protected by `AdminRoute` component
- **Automatic Redirection**: Non-admin users are redirected to `/drive`
- **Self-Protection**: Admins cannot delete themselves or demote their own admin role

### Navigation

- **Sidebar Access**: Admin section appears in sidebar only for admin users
- **Shield Icon**: Admin dashboard identified with shield icon
- **Active State**: Current admin page highlighted in navigation

## Technical Architecture

### Backend API Routes (`/api/admin/*`)

All routes require authentication and admin role via middleware:

```javascript
router.use(requireRole("admin"));
```

#### Endpoints

- `GET /api/admin/stats` - System-wide statistics
- `GET /api/admin/users` - Paginated user list with filters
- `GET /api/admin/users/:userId` - Detailed user information
- `PUT /api/admin/users/:userId/role` - Update user role
- `DELETE /api/admin/users/:userId` - Delete user and their data
- `GET /api/admin/files` - Paginated file list with filters
- `DELETE /api/admin/files/:fileId` - Delete any file
- `GET /api/admin/activity` - Recent system activity
- `GET /api/admin/storage-report` - Storage usage by user

### Frontend Architecture

#### Context API

**AdminContext** (`client/src/contexts/AdminContext.js`):

- Centralized state management for admin operations
- Handles API calls and error handling
- Provides hooks for all admin components
- Manages pagination state

#### Components

Located in `client/src/components/admin/`:

- `AdminDashboard.jsx` - Main overview page
- `UserManagement.jsx` - User CRUD operations
- `FileManagement.jsx` - File administration
- `StorageReport.jsx` - Storage analytics
- `ActivityLog.jsx` - System activity viewer

Each component has its own CSS module for styling.

#### Route Protection

**AdminRoute** (`client/src/components/common/AdminRoute.jsx`):

- HOC that wraps admin routes
- Checks user authentication and role
- Redirects unauthorized users
- Shows loading state during auth check

### State Management Flow

```
AdminContext → useAdmin() hook → Admin Components
                                   ↓
                              API Calls (via api.admin.*)
                                   ↓
                              Backend Routes (/api/admin/*)
```

## Usage

### Accessing the Admin Dashboard

1. Log in as a user with `admin` role
2. Click "Dashboard" in the Admin section of the sidebar
3. Navigate between sections using the quick action buttons or direct URLs

### Managing Users

1. Navigate to `/admin/users`
2. Use search to find specific users
3. Click edit icon to change user role
4. Click delete icon to remove users (confirmation required)

### Managing Files

1. Navigate to `/admin/files`
2. Filter by file type or search by name
3. Click delete icon to remove files (confirmation required)
4. View owner information for each file

### Monitoring Storage

1. Navigate to `/admin/storage`
2. View all users sorted by storage usage
3. Identify users approaching their limits
4. See real-time usage percentages

### Viewing Activity

1. Navigate to `/admin/activity`
2. See recent file uploads with details
3. View new user registrations
4. All activities sorted by timestamp

## Security Considerations

### Backend Security

- All routes protected by JWT authentication
- Role verification on every request
- Input validation and sanitization
- Logging of all admin actions

### Frontend Security

- Route protection with AdminRoute component
- User role stored in authenticated context
- No sensitive operations in client code
- Error messages don't leak system information

### Audit Trail

All admin actions are logged with:

- Admin user ID
- Target user/file ID
- Action performed
- Timestamp
- Result (success/failure)

## Database Impact

### User Deletion

When an admin deletes a user, the following are removed:

- User account
- All files owned by the user
- All folders owned by the user
- All upload sessions
- File storage is NOT automatically cleaned from disk (manual cleanup required)

### Role Changes

When an admin changes a user's role:

- Storage limit automatically updates based on new role
- User's pre-save hook applies new limits
- No data loss occurs

## Performance Considerations

### Pagination

- Default 50 items per page for users and files
- Configurable page size
- Efficient database queries with skip/limit

### Caching

- No client-side caching (always fresh data)
- Refresh button to manually reload stats
- Context state preserved during navigation

### Large Datasets

- Aggregation pipelines for statistics
- Indexed queries for fast lookups
- Limited result sets prevent memory issues

## Future Enhancements

Potential improvements for the admin dashboard:

- **Advanced Analytics**: Charts and graphs for trends
- **Bulk Operations**: Manage multiple users/files at once
- **Export Reports**: Download CSV/PDF reports
- **Email Notifications**: Send announcements to users
- **Audit Log**: Detailed history of all admin actions
- **User Impersonation**: View system as another user
- **Scheduled Tasks**: Automated cleanup and maintenance
- **Real-time Updates**: WebSocket for live statistics
- **File Preview**: View files without downloading
- **Advanced Search**: Full-text search across all data

## Troubleshooting

### Admin Section Not Visible

- Verify user role is `admin` in database
- Check localStorage user object has correct role
- Clear browser cache and re-login

### Permission Denied

- Ensure JWT token is valid
- Verify `requireRole` middleware is working
- Check server logs for authentication errors

### Data Not Loading

- Check browser console for API errors
- Verify backend server is running
- Check network tab for failed requests
- Review server logs for error details

## Development Notes

### Adding New Admin Features

1. Create backend route in `server/routes/admin.js`
2. Add API method in `client/src/services/api.js`
3. Create action in `AdminContext.js`
4. Build UI component in `components/admin/`
5. Add route in `App.js` with AdminRoute protection
6. Update navigation if needed

### Styling Consistency

- Use CSS Modules for component styles
- Follow existing color scheme from theme.css
- Maintain mobile-responsive design
- Test at 320px, 768px, and 1400px widths

### Logging Best Practices

- Log all admin actions with full context
- Include user IDs, timestamps, and results
- Use appropriate log levels (info, warn, error)
- Never log sensitive data (passwords, tokens)

## API Reference

See `docs/API_REFERENCE.md` for detailed endpoint documentation including request/response formats, error codes, and examples.

## Related Documentation

- `docs/RBAC.md` - Role-based access control system
- `docs/AUTHENTICATION.md` - JWT authentication flow
- `docs/LOGGING.md` - Logging configuration and usage
- `server/routes/admin.js` - Backend implementation
- `client/src/contexts/AdminContext.js` - Frontend state management
