# MyDrive - Cloud Storage Application

A full-stack cloud storage application built with React and Node.js, featuring file management, sharing capabilities, chunked file uploads, and user authentication.

## 🚀 Features

- **Advanced File Management:** Upload, download, rename, delete files and folders
- **Chunked File Uploads:** Support for large file uploads with resume capability
- **File Sharing:** Share files with other users with different permission levels
- **User Authentication:** Secure JWT-based authentication system
- **Responsive Design:** Optimized for desktop and mobile devices
- **Search Functionality:** Find files and folders quickly
- **Grid/List Views:** Multiple viewing options for file organization
- **Trash & Recovery:** Soft delete with trash management
- **User Profiles:** Customizable user preferences and settings

## 🛠 Technology Stack

- **Frontend:** React 19, React Router, Axios, Lucide React, React Toastify
- **Backend:** Node.js, Express, MongoDB, JWT, Multer
- **Database:** MongoDB with Mongoose ODM
- **File Upload:** Chunked upload with retry logic and progress tracking

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd MyDrive
```

### 2. Environment Configuration

Create `.env` files based on the provided examples:

**Server** (`server/.env`):

```bash
cp server/.env.example server/.env
# Edit server/.env and set your values
```

**Client** (`client/.env`):

```bash
cp client/.env.example client/.env
# Edit client/.env and set your values
```

### 3. Backend Setup

```bash
cd server
npm install
npm start
```

Server will run on: `http://localhost:8080`

### 4. Frontend Setup

```bash
cd client
npm install
npm start
```

Client will run on: `http://localhost:3000`

## 📁 Project Structure

```
MyDrive/
├── client/                 # React frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React context providers
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── package.json
│
├── server/                # Node.js backend
│   ├── middleware/        # Express middleware
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── utils/             # Helper utilities
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🚀 Production Deployment

### Building for Production

**Client:**

```bash
cd client
npm run build
```

**Server:**

```bash
cd server
npm start
```

### Environment Variables for Production

Ensure all environment variables are properly set:

- `MONGODB_URI`: Your production MongoDB connection string
- `JWT_SECRET`: A strong, unique secret key
- `PORT`: Server port (default: 8080)
- `REACT_APP_API_URL`: Your production API URL

### Deployment Platforms

This application can be deployed to:

- **Frontend:** Vercel, Netlify, GitHub Pages
- **Backend:** Heroku, AWS, DigitalOcean, Railway
- **Database:** MongoDB Atlas (recommended for production)

## � Security Considerations

- Always use strong `JWT_SECRET` in production
- Enable HTTPS in production
- Set proper CORS configuration
- Keep dependencies updated
- Never commit `.env` files

## 🧪 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Files

- `GET /api/files` - Get user files
- `POST /api/files/upload` - Upload file
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/chunked-upload/initiate` - Initiate chunked upload
- `POST /api/files/chunked-upload/:uploadId/chunk` - Upload chunk
- `POST /api/files/chunked-upload/:uploadId/complete` - Complete upload

### Folders

- `GET /api/folders` - Get user folders
- `POST /api/folders` - Create folder
- `DELETE /api/folders/:id` - Delete folder

### Sharing

- `POST /api/shared/share` - Share file/folder
- `GET /api/shared/with-me` - Get shared items

## 📝 Scripts

### Client Scripts

- `npm start` - Start development server
- `npm run build` - Build for production

### Server Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

For issues and questions, please open an issue on the GitHub repository.
