import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";
import logger from "../utils/logger";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [systemStats, setSystemStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState(null);
  const [storageReport, setStorageReport] = useState(null);
  const [dashboardPreferences, setDashboardPreferences] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination states
  const [usersPagination, setUsersPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const [filesPagination, setFilesPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  /**
   * Fetch system statistics
   */
  const fetchSystemStats = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Fetching system statistics", params);

      const response = await api.admin.getSystemStats(params);
      setSystemStats(response.data);

      logger.info("System statistics fetched successfully", {
        totalUsers: response.data.users.total,
        totalFiles: response.data.files.total,
      });

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch system statistics";
      logger.error("Error fetching system stats", {
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch users list with pagination and filters
   */
  const fetchUsers = useCallback(
    async (params = {}) => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = {
          page: params.page || usersPagination.page,
          limit: params.limit || usersPagination.limit,
          role: params.role,
          search: params.search,
          sortBy: params.sortBy || "createdAt",
          sortOrder: params.sortOrder || "desc",
        };

        logger.info("Fetching users list", queryParams);

        const response = await api.admin.getUsers(queryParams);
        setUsers(response.data.users);
        setUsersPagination(response.data.pagination);

        logger.info("Users list fetched successfully", {
          count: response.data.users.length,
          total: response.data.pagination.total,
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err.response?.data?.error || "Failed to fetch users";
        logger.error("Error fetching users", {
          error: errorMessage,
          status: err.response?.status,
        });
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [usersPagination.page, usersPagination.limit],
  );

  /**
   * Fetch user details
   */
  const fetchUserDetails = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Fetching user details", { userId });

      const response = await api.admin.getUserDetails(userId);

      logger.info("User details fetched successfully", { userId });

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch user details";
      logger.error("Error fetching user details", {
        userId,
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update user role
   */
  const updateUserRole = useCallback(async (userId, role) => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Updating user role", { userId, role });

      const response = await api.admin.updateUserRole(userId, role);

      // Update user in local state
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId ? response.data.user : user,
        ),
      );

      logger.info("User role updated successfully", { userId, role });

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to update user role";
      logger.error("Error updating user role", {
        userId,
        role,
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete user
   */
  const deleteUser = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Deleting user", { userId });

      const response = await api.admin.deleteUser(userId);

      // Remove user from local state
      setUsers((prevUsers) => prevUsers.filter((user) => user._id !== userId));

      // Update pagination
      setUsersPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
      }));

      logger.info("User deleted successfully", {
        userId,
        deletedFiles: response.data.deletedFiles,
        deletedFolders: response.data.deletedFolders,
      });

      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to delete user";
      logger.error("Error deleting user", {
        userId,
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch files list with pagination and filters
   */
  const fetchFiles = useCallback(
    async (params = {}) => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = {
          page: params.page || filesPagination.page,
          limit: params.limit || filesPagination.limit,
          userId: params.userId,
          mimeType: params.mimeType,
          search: params.search,
          sortBy: params.sortBy || "uploadedAt",
          sortOrder: params.sortOrder || "desc",
        };

        logger.info("Fetching files list", queryParams);

        const response = await api.admin.getFiles(queryParams);
        setFiles(response.data.files);
        setFilesPagination(response.data.pagination);

        // Log files with null owners for debugging
        const filesWithNullOwner = response.data.files.filter(
          (file) => !file.owner,
        );
        if (filesWithNullOwner.length > 0) {
          logger.warn("Files with null owner received from API", {
            count: filesWithNullOwner.length,
            sampleFile: filesWithNullOwner[0],
          });
        }

        logger.info("Files list fetched successfully", {
          count: response.data.files.length,
          total: response.data.pagination.total,
        });

        return response.data;
      } catch (err) {
        const errorMessage =
          err.response?.data?.error || "Failed to fetch files";
        logger.error("Error fetching files", {
          error: errorMessage,
          status: err.response?.status,
        });
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [filesPagination.page, filesPagination.limit],
  );

  /**
   * Delete file (admin override)
   */
  const deleteFile = useCallback(async (fileId) => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Admin deleting file", { fileId });

      const response = await api.admin.deleteFile(fileId);

      // Remove file from local state
      setFiles((prevFiles) => prevFiles.filter((file) => file._id !== fileId));

      // Update pagination
      setFilesPagination((prev) => ({
        ...prev,
        total: prev.total - 1,
      }));

      logger.info("File deleted successfully by admin", {
        fileId,
        fileName: response.data.file.name,
      });

      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to delete file";
      logger.error("Error deleting file", {
        fileId,
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch system activity
   */
  const fetchActivity = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = {
        limit: params.limit || 100,
      };

      logger.info("Fetching system activity", queryParams);

      const response = await api.admin.getActivity(queryParams);
      setActivity(response.data);

      logger.info("System activity fetched successfully");

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch system activity";
      logger.error("Error fetching system activity", {
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch storage report
   */
  const fetchStorageReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info("Fetching storage report");

      const response = await api.admin.getStorageReport();
      setStorageReport(response.data);

      logger.info("Storage report fetched successfully", {
        userCount: response.data.users.length,
      });

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch storage report";
      logger.error("Error fetching storage report", {
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch dashboard preferences
   */
  const fetchDashboardPreferences = useCallback(async () => {
    try {
      logger.info("Fetching dashboard preferences");

      const response = await api.admin.getDashboardPreferences();
      setDashboardPreferences(response.data);

      logger.info("Dashboard preferences fetched successfully", {
        visibleWidgets: response.data.visibleWidgets?.length,
      });

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch dashboard preferences";
      logger.error("Error fetching dashboard preferences", {
        error: errorMessage,
        status: err.response?.status,
      });
      // Don't set error state for preferences - use defaults
      return null;
    }
  }, []);

  /**
   * Save dashboard preferences
   */
  const saveDashboardPreferences = useCallback(async (preferences) => {
    try {
      logger.info("Saving dashboard preferences", {
        visibleWidgetsCount: preferences.visibleWidgets?.length,
      });

      const response = await api.admin.saveDashboardPreferences(preferences);
      setDashboardPreferences(response.data.preferences);

      logger.info("Dashboard preferences saved successfully");

      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to save dashboard preferences";
      logger.error("Error saving dashboard preferences", {
        error: errorMessage,
        status: err.response?.status,
      });
      setError(errorMessage);
      throw err;
    }
  }, []);

  const value = {
    // State
    systemStats,
    users,
    files,
    activity,
    storageReport,
    dashboardPreferences,
    loading,
    error,
    usersPagination,
    filesPagination,

    // Actions
    fetchSystemStats,
    fetchUsers,
    fetchUserDetails,
    updateUserRole,
    deleteUser,
    fetchFiles,
    deleteFile,
    fetchActivity,
    fetchStorageReport,
    fetchDashboardPreferences,
    saveDashboardPreferences,
  };

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
};

export default AdminContext;
