# MyDrive - Cloud Storage Application

A full-stack cloud storage solution with advanced file management, sharing capabilities, and chunked uploads for large files.

## Features

- File & Folder Management - Organize files in hierarchical folders
- Chunked File Upload - Support for large files with resume capability
- Secure Authentication - JWT-based authentication with bcrypt hashing
- Email Notifications - Welcome emails, password reset, and sharing alerts
- Password Reset - Secure token-based password recovery
- File Sharing - Share files/folders with other users via email
- Trash Management - Soft delete with restore functionality
- Responsive Design - Optimized for desktop and mobile devices
- Search - Find files and folders quickly
- Storage Management - Track storage usage and limits

## Tech Stack

**Frontend:** React 19, React Router, Axios  
**Backend:** Node.js, Express, MongoDB  
**Authentication:** JWT, bcryptjs  
**Email:** Nodemailer (Gmail/SendGrid/SMTP)

## Quick Start

### Prerequisites
- Node.js v14+
- MongoDB v4.4+
- npm or yarn

### Installation

1. Clone and install dependencies
```bash
git clone <repository-url>
cd MyDrive

# Backend
cd server && npm install

# Frontend
cd client && npm install
```

2. Configure environment (copy .env.example to .env in both directories)

3. Run development servers
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm start
```

Visit: http://localhost:5000

## Documentation

Comprehensive documentation available in `docs/` directory:

- **AUTHENTICATION.md** - User authentication, JWT, password reset
- **FILE_MANAGEMENT.md** - File upload, download, chunked uploads
- **FOLDER_MANAGEMENT.md** - Folder operations, navigation, trash
- **FILE_SHARING.md** - Sharing files/folders with permissions
- **EMAIL_SERVICE.md** - Email configuration and notifications
- **API_REFERENCE.md** - Complete API documentation
- **DEPLOYMENT.md** - Production deployment guide

## License

MIT License

---

**Built with ❤️ for secure cloud storage**
