import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL ||
  `http://${window.location.hostname}:8080/api`;

// Set up axios interceptor to add auth token to requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if we're not on login/register pages and have a token
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      const hasToken = localStorage.getItem("token");

      // Don't redirect if we're already on auth pages or don't have a token
      if (
        hasToken &&
        !currentPath.includes("/login") &&
        !currentPath.includes("/register")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

const api = {
  // User profile operations
  getUserProfile: () => axios.get(`${API_URL}/users/profile`),
  updateUserProfile: (data) => axios.put(`${API_URL}/users/profile`, data),
  // Auth operations
  register: (name, email, password) =>
    axios.post(`${API_URL}/auth/register`, { name, email, password }),

  login: (email, password) =>
    axios.post(`${API_URL}/auth/login`, { email, password }),

  getCurrentUser: () => axios.get(`${API_URL}/auth/me`),

  // Password reset operations
  forgotPassword: (email) =>
    axios.post(`${API_URL}/auth/forgot-password`, { email }),

  resetPassword: (token, newPassword) =>
    axios.post(`${API_URL}/auth/reset-password`, { token, newPassword }),

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  // Folder operations
  getFolderContents: (
    folderId = "root",
    isTrash = false,
    page = 1,
    limit = 50
  ) =>
    axios.get(`${API_URL}/folders/${folderId}`, {
      params: { trash: isTrash, page, limit },
    }),

  createFolder: (name, parent = "root") =>
    axios.post(`${API_URL}/folders`, { name, parent }),

  // File operations
  uploadFile: (file, parent = "root", onUploadProgress = null) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("parent", parent);

    const config = {
      headers: { "Content-Type": "multipart/form-data" },
    };

    if (onUploadProgress) {
      config.onUploadProgress = (progressEvent) => {
        const { loaded, total } = progressEvent;
        onUploadProgress(loaded, total);
      };
    }

    return axios.post(`${API_URL}/files/upload`, formData, config);
  },

  downloadFile: (fileId) =>
    axios.get(`${API_URL}/files/download/${fileId}`, { responseType: "blob" }),

  // Get thumbnail for file card previews (optimized, cached)
  getFileThumbnail: (fileId) =>
    axios.get(`${API_URL}/files/thumbnail/${fileId}`, {
      responseType: "blob",
      headers: {
        "Cache-Control": "public, max-age=31536000",
      },
    }),

  // Get file for preview (returns blob/url for streaming)
  getFilePreview: (fileId) =>
    axios.get(`${API_URL}/files/download/${fileId}`, {
      responseType: "blob",
      headers: {
        "Cache-Control": "public, max-age=31536000",
      },
    }),

  // Get item details with populated shared users
  getFileDetails: (fileId) => axios.get(`${API_URL}/files/${fileId}/details`),

  getFolderDetails: (folderId) =>
    axios.get(`${API_URL}/folders/${folderId}/details`),

  // Share operations
  shareItem: (type, id, email) =>
    axios.post(`${API_URL}/${type}/${id}/share`, { email }),

  unshareItem: (type, id, userId) =>
    axios.delete(`${API_URL}/${type}/${id}/share/${userId}`),

  // User search
  searchUsers: (query) =>
    axios.get(`${API_URL}/users/search`, { params: { query } }),

  // Get shared items
  getSharedItems: (page = 1, limit = 50) =>
    axios.get(`${API_URL}/shared`, { params: { page, limit } }),

  // Trash operations
  moveToTrash: (type, id) => axios.delete(`${API_URL}/${type}/${id}`),

  restoreFromTrash: (type, id) =>
    axios.post(`${API_URL}/${type}/${id}/restore`),

  deleteItemPermanently: (type, id) =>
    axios.delete(`${API_URL}/${type}/${id}`, { params: { permanent: true } }),

  emptyTrash: () => axios.delete(`${API_URL}/trash/empty`),

  // Search
  search: (query, page = 1, limit = 50) =>
    axios.get(`${API_URL}/search`, { params: { query, page, limit } }),

  // Rename operations
  renameFile: (fileId, name) =>
    axios.put(`${API_URL}/files/${fileId}/rename`, { name }),

  renameFolder: (folderId, name) =>
    axios.put(`${API_URL}/folders/${folderId}/rename`, { name }),

  // Copy operations
  copyFile: (fileId, parent, name) =>
    axios.post(`${API_URL}/files/${fileId}/copy`, { parent, name }),

  copyFolder: (folderId, parent, name) =>
    axios.post(`${API_URL}/folders/${folderId}/copy`, { parent, name }),

  // Move operations
  moveFile: (fileId, parent) =>
    axios.put(`${API_URL}/files/${fileId}/move`, { parent }),

  moveFolder: (folderId, parent) =>
    axios.put(`${API_URL}/folders/${folderId}/move`, { parent }),

  // ========== CHUNKED UPLOAD OPERATIONS ==========

  // Initiate chunked upload
  initiateChunkedUpload: (uploadData) =>
    axios.post(`${API_URL}/files/chunked-upload/initiate`, uploadData),

  // Upload a chunk
  uploadChunk: (uploadId, chunkData) => {
    const { chunk, index, size, start, end, hash } = chunkData;

    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("index", index.toString());
    formData.append("size", size.toString());
    formData.append("start", start.toString());
    formData.append("end", end.toString());

    if (hash) {
      formData.append("hash", hash);
    }

    return axios.post(
      `${API_URL}/files/chunked-upload/${uploadId}/chunk`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000, // Optimized 30 second timeout for parallel uploads
        maxContentLength: 20 * 1024 * 1024, // 20MB max chunk size for larger chunks
        maxBodyLength: 20 * 1024 * 1024, // 20MB max body size
        maxRedirects: 0, // Disable redirects for performance
        validateStatus: (status) => status >= 200 && status < 300, // Only accept 2xx responses
      }
    );
  },

  // Complete chunked upload
  completeChunkedUpload: (uploadId, completeData) =>
    axios.post(
      `${API_URL}/files/chunked-upload/${uploadId}/complete`,
      completeData
    ),

  // Get upload session status
  getUploadStatus: (uploadId) =>
    axios.get(`${API_URL}/files/chunked-upload/${uploadId}/status`),

  // Cancel chunked upload
  cancelChunkedUpload: (uploadId) =>
    axios.delete(`${API_URL}/files/chunked-upload/${uploadId}`),

  // Pause chunked upload
  pauseChunkedUpload: (uploadId) =>
    axios.post(`${API_URL}/files/chunked-upload/${uploadId}/pause`),

  // Resume chunked upload
  resumeChunkedUpload: (uploadId) =>
    axios.post(`${API_URL}/files/chunked-upload/${uploadId}/resume`),

  // List active upload sessions
  getActiveUploadSessions: () =>
    axios.get(`${API_URL}/files/chunked-upload/sessions`),

  // Resume upload (get status for resuming)
  resumeUpload: (uploadId) =>
    axios.get(`${API_URL}/files/chunked-upload/${uploadId}/status`),
};

export default api;
