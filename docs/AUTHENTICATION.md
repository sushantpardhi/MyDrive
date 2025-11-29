# Authentication System

## Overview

MyDrive uses JWT (JSON Web Token) based authentication with bcrypt password hashing for secure user management.

## Features

- User registration with email validation
- Secure login with JWT token generation
- Password reset functionality via email
- Token-based session management
- Automatic token refresh

## Architecture

### Password Security

- **Hashing Algorithm**: bcryptjs with 10 salt rounds
- **Password Requirements**: Minimum 6 characters (configurable)
- **Storage**: Hashed passwords stored in MongoDB

### JWT Configuration

```javascript
{
  secret: process.env.JWT_SECRET,
  expiresIn: '7d' // 7 days
}
```

## API Endpoints

### 1. Register User

**Endpoint**: `POST /api/auth/register`

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Features**:

- Sends welcome email (if email service configured)
- Creates user profile with default settings
- Returns JWT token for immediate login

### 2. Login User

**Endpoint**: `POST /api/auth/login`

**Request Body**:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response**:

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

### 3. Forgot Password

**Endpoint**: `POST /api/auth/forgot-password`

**Request Body**:

```json
{
  "email": "john@example.com"
}
```

**Response**:

```json
{
  "message": "Password reset email sent"
}
```

**Process**:

1. Generates JWT token with 1-hour expiration
2. Token includes `type: 'password_reset'` claim
3. Sends email with reset link to `CLIENT_URL/reset-password?token=...`
4. User clicks link and enters new password

### 4. Reset Password

**Endpoint**: `POST /api/auth/reset-password`

**Request Body**:

```json
{
  "token": "reset_token_from_email",
  "newPassword": "newpassword123"
}
```

**Response**:

```json
{
  "message": "Password reset successful"
}
```

**Validation**:

- Token must be valid and not expired
- Token must have `type: 'password_reset'`
- New password must meet requirements

### 5. Get User Details

**Endpoint**: `GET /api/auth/user`

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response**:

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

## Frontend Implementation

### Auth Context

Location: `client/src/contexts/AuthContext.js`

**State Management**:

```javascript
const [user, setUser] = useState(null);
const [token, setToken] = useState(localStorage.getItem("token"));
const [loading, setLoading] = useState(true);
```

**Methods**:

- `login(email, password)` - Login and store token
- `register(name, email, password)` - Register new user
- `logout()` - Clear token and user data
- `loadUser()` - Load user from stored token

### Protected Routes

```javascript
// Usage in App.js
<Route
  path="/drive"
  element={
    <ProtectedRoute>
      <DriveView />
    </ProtectedRoute>
  }
/>
```

### Axios Interceptor

Location: `client/src/services/api.js`

**Auto-attach token**:

```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Auto-handle 401 errors**:

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

## Security Best Practices

### 1. Password Storage

✅ Never store plain text passwords  
✅ Use bcrypt with minimum 10 salt rounds  
✅ Hash on server-side only

### 2. JWT Security

✅ Use strong secret (minimum 32 characters)  
✅ Set appropriate expiration times  
✅ Store tokens in localStorage (or httpOnly cookies for enhanced security)  
✅ Validate token on every request

### 3. Password Reset

✅ Use time-limited tokens (1 hour)  
✅ Include token type in JWT claims  
✅ Invalidate token after use  
✅ Send reset link via email only

### 4. Production Configuration

```env
# Strong JWT secret (change in production!)
JWT_SECRET=your-super-secret-key-minimum-32-characters-long

# Appropriate expiration
JWT_EXPIRATION=7d

# Secure client URL for email links
CLIENT_URL=https://yourdomain.com
```

## Error Handling

### Common Error Codes

- `400` - Invalid input (email format, password length)
- `401` - Invalid credentials or expired token
- `404` - User not found
- `409` - Email already exists (registration)
- `500` - Server error

### Example Error Response

```json
{
  "error": "Invalid email or password"
}
```

## Testing Authentication

### Manual Testing Checklist

- [ ] Register with valid email
- [ ] Register with duplicate email (should fail)
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Access protected route without token (should redirect)
- [ ] Request password reset
- [ ] Reset password with valid token
- [ ] Try to reuse reset token (should fail)
- [ ] Token expiration (wait 7 days or change expiration for testing)

### Testing with cURL

**Register**:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

**Login**:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Get User**:

```bash
curl http://localhost:8080/api/auth/user \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Issue: "jwt malformed" error

**Solution**: Check that JWT_SECRET is set in server/.env and is minimum 32 characters

### Issue: Token not persisting

**Solution**: Check browser localStorage and ensure token is being saved on login

### Issue: Automatic logout on page refresh

**Solution**: Verify that AuthContext.loadUser() is called on app mount

### Issue: Password reset email not sending

**Solution**: Check email service configuration in server/.env (see EMAIL_SERVICE.md)

## Related Documentation

- [Email Service](./EMAIL_SERVICE.md) - Email configuration for password reset
- [User Management](./USER_MANAGEMENT.md) - User profile and settings
- [Security](./SECURITY.md) - Security best practices
