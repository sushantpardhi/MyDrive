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
  changePassword: (currentPassword, newPassword) =>
    axios.put(`${API_URL}/users/change-password`, {
      currentPassword,
      newPassword,
    }),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return axios.post(`${API_URL}/users/avatar`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAvatar: () => axios.delete(`${API_URL}/users/avatar`),
  deleteAccount: (password) =>
    axios.delete(`${API_URL}/users/account`, { data: { password } }),
  getAccountStats: () => axios.get(`${API_URL}/users/stats`),
  getActivityLog: (limit = 10) =>
    axios.get(`${API_URL}/users/activity`, { params: { limit } }),

  // Storage statistics
  getStorageStats: () => axios.get(`${API_URL}/users/storage`),

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
    limit = 50,
    sortBy = "createdAt",
    sortOrder = "desc"
  ) =>
    axios.get(`${API_URL}/folders/${folderId}`, {
      params: { trash: isTrash, page, limit, sortBy, sortOrder },
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

  downloadFolder: (folderId) =>
    axios.get(`${API_URL}/folders/download/${folderId}`, {
      responseType: "blob",
    }),

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

  // Get folder statistics (file count, total size)
  getFolderStats: (folderId) =>
    axios.get(`${API_URL}/folders/${folderId}/stats`),

  // Share operations
  shareItem: (type, id, email) =>
    axios.post(`${API_URL}/${type}/${id}/share`, { email }),

  bulkShareItems: (email, items) =>
    axios.post(`${API_URL}/shared/bulk-share`, { email, items }),

  unshareItem: (type, id, userId) =>
    axios.delete(`${API_URL}/${type}/${id}/share/${userId}`),

  // User search
  searchUsers: (query) =>
    axios.get(`${API_URL}/users/search`, { params: { query } }),

  // Verify password for permanent deletion
  verifyPassword: (password) =>
    axios.post(`${API_URL}/users/verify-password`, { password }),

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

  // Search with advanced filters
  search: (query, page = 1, limit = 50, filters = {}) => {
    const params = { page, limit };

    // Only add query if it's not empty
    if (query && query.trim()) {
      params.query = query.trim();
    }

    // Add optional filters
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      params.fileTypes = filters.fileTypes.join(",");
    }
    if (filters.sizeMin !== undefined && filters.sizeMin !== "") {
      params.sizeMin = filters.sizeMin;
    }
    if (filters.sizeMax !== undefined && filters.sizeMax !== "") {
      params.sizeMax = filters.sizeMax;
    }
    if (filters.dateStart) {
      params.dateStart = filters.dateStart;
    }
    if (filters.dateEnd) {
      params.dateEnd = filters.dateEnd;
    }
    if (filters.sortBy) {
      params.sortBy = filters.sortBy;
    }
    if (filters.sortOrder) {
      params.sortOrder = filters.sortOrder;
    }
    if (filters.folderId) {
      params.folderId = filters.folderId;
    }

    const searchUrl = `${API_URL}/search`;

    return axios
      .get(searchUrl, {
        params,
        timeout: 30000, // 30 second timeout
      })
      .then((response) => {
        return response;
      })
      .catch((error) => {
        throw error;
      });
  },

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
  uploadChunk: (uploadId, chunkData, abortSignal = null) => {
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

    const config = {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000, // Optimized 30 second timeout for parallel uploads
      maxContentLength: 20 * 1024 * 1024, // 20MB max chunk size for larger chunks
      maxBodyLength: 20 * 1024 * 1024, // 20MB max body size
      maxRedirects: 0, // Disable redirects for performance
      validateStatus: (status) => status >= 200 && status < 300, // Only accept 2xx responses
    };

    // Add abort signal if provided
    if (abortSignal) {
      config.signal = abortSignal;
    }

    return axios.post(
      `${API_URL}/files/chunked-upload/${uploadId}/chunk`,
      formData,
      config
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

  // Admin operations
  admin: {
    // System statistics
    getSystemStats: () => axios.get(`${API_URL}/admin/stats`),

    // User management
    getUsers: (params) => axios.get(`${API_URL}/admin/users`, { params }),
    getUserDetails: (userId) => axios.get(`${API_URL}/admin/users/${userId}`),
    updateUserRole: (userId, role) =>
      axios.put(`${API_URL}/admin/users/${userId}/role`, { role }),
    deleteUser: (userId) => axios.delete(`${API_URL}/admin/users/${userId}`),

    // File management
    getFiles: (params) => axios.get(`${API_URL}/admin/files`, { params }),
    deleteFile: (fileId) => axios.delete(`${API_URL}/admin/files/${fileId}`),

    // Activity and reports
    getActivity: (params) => axios.get(`${API_URL}/admin/activity`, { params }),
    getStorageReport: () => axios.get(`${API_URL}/admin/storage-report`),
  },
};

export default api;
