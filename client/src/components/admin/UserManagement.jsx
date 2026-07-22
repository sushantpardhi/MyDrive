import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  HardDrive,
  FileText,
  Download,
  RefreshCw,
  UserPlus,
  Shield,
  UserX,
} from "lucide-react";
import { useAdmin, useAuth } from "../../contexts";
import { formatFileSize, formatDate } from "../../utils/formatters";
import { getUserInitials, getAvatarColor } from "../../utils/helpers";
import logger from "../../utils/logger";
import styles from "./UserManagement.module.css";

const UserManagement = () => {
  const BYTES_IN_UNIT = {
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  const STORAGE_QUOTA_OPTIONS = [
    { key: "5GB", label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
    { key: "10GB", label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
    { key: "20GB", label: "20 GB", bytes: 20 * 1024 * 1024 * 1024 },
    { key: "50GB", label: "50 GB", bytes: 50 * 1024 * 1024 * 1024 },
    { key: "100GB", label: "100 GB", bytes: 100 * 1024 * 1024 * 1024 },
  ];

  const ROLE_DEFAULT_STORAGE_LIMITS = {
    admin: -1,
    family: -1,
    user: 5 * 1024 * 1024 * 1024,
    guest: 500 * 1024 * 1024,
  };

  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    users,
    usersPagination,
    loading,
    fetchUsers,
    updateUserRole,
    updateUserStorageLimit,
    deleteUser,
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [selectedQuotaOption, setSelectedQuotaOption] = useState("10GB");
  const [isUnlimitedStorage, setIsUnlimitedStorage] = useState(false);
  const [storageLimitAmount, setStorageLimitAmount] = useState("");
  const [storageLimitUnit, setStorageLimitUnit] = useState("GB");
  const [isExporting, setIsExporting] = useState(false);

  // Calculate statistics from current users data
  const statistics = useMemo(() => {
    if (!users || users.length === 0) {
      return {
        total: 0,
        admins: 0,
        family: 0,
        guests: 0,
        totalStorage: 0,
        totalFiles: 0,
      };
    }

    return users.reduce(
      (acc, user) => {
        acc.total++;
        if (user.role === "admin") acc.admins++;
        if (user.role === "family") acc.family++;
        if (user.role === "guest") acc.guests++;
        acc.totalStorage += user.storageUsed || 0;
        acc.totalFiles += user.fileCount || 0;
        return acc;
      },
      {
        total: 0,
        admins: 0,
        family: 0,
        guests: 0,
        totalStorage: 0,
        totalFiles: 0,
      },
    );
  }, [users]);

  const handleExportUsers = async () => {
    setIsExporting(true);
    try {
      const csvContent = [
        ["Name", "Email", "Role", "Storage Used", "Files", "Joined"].join(","),
        ...users.map((user) =>
          [
            user.name,
            user.email,
            user.role,
            formatFileSize(user.storageUsed),
            user.fileCount || 0,
            formatDate(user.createdAt),
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      logger.info("Users exported successfully");
    } catch (error) {
      logger.error("Failed to export users", { error: error.message });
      alert("Failed to export users");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      navigate("/drive");
      return;
    }
    loadUsers();
  }, [currentUser]);

  const loadUsers = async (params = {}) => {
    try {
      await fetchUsers({
        page: params.page || 1,
        limit: 50,
        search: searchQuery,
        role: roleFilter,
        sortBy,
        sortOrder,
        ...params,
      });
    } catch (error) {
      logger.error("Failed to load users", { error: error.message });
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers({ page: 1 });
  };

  const handleRoleChange = () => {
    setShowRoleModal(true);
  };

  const handleStorageLimitChange = (user) => {
    if (!user) return;

    const currentLimit = user.storageLimit;

    if (currentLimit === -1) {
      setIsUnlimitedStorage(true);
      setSelectedQuotaOption("10GB");
      setStorageLimitUnit("GB");
      setStorageLimitAmount("10");
      setShowStorageModal(true);
      return;
    }

    setIsUnlimitedStorage(false);

    const matchingPreset = STORAGE_QUOTA_OPTIONS.find(
      (option) => option.bytes === currentLimit,
    );

    if (matchingPreset) {
      setSelectedQuotaOption(matchingPreset.key);
      setStorageLimitUnit("GB");
      setStorageLimitAmount((matchingPreset.bytes / BYTES_IN_UNIT.GB).toString());
      setShowStorageModal(true);
      return;
    }

    if (Number.isFinite(currentLimit) && currentLimit > 0) {
      setSelectedQuotaOption("custom");
      if (currentLimit >= BYTES_IN_UNIT.TB) {
        setStorageLimitUnit("TB");
        setStorageLimitAmount((currentLimit / BYTES_IN_UNIT.TB).toFixed(2));
      } else if (currentLimit >= BYTES_IN_UNIT.GB) {
        setStorageLimitUnit("GB");
        setStorageLimitAmount((currentLimit / BYTES_IN_UNIT.GB).toFixed(2));
      } else {
        setStorageLimitUnit("MB");
        setStorageLimitAmount((currentLimit / BYTES_IN_UNIT.MB).toFixed(2));
      }
    } else {
      setSelectedQuotaOption("10GB");
      setStorageLimitUnit("GB");
      setStorageLimitAmount("10");
    }

    setShowStorageModal(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await updateUserRole(selectedUser._id, newRole);
      setShowRoleModal(false);
      setSelectedUser(null);
      setNewRole("");
      logger.info("User role updated", { userId: selectedUser._id, newRole });
    } catch (error) {
      logger.error("Failed to update user role", {
        error: error.message,
        userId: selectedUser._id,
      });
      alert(error.response?.data?.error || "Failed to update user role");
    }
  };

  const confirmStorageLimitChange = async () => {
    if (!selectedUser) return;

    let storageLimitBytes;

    if (isUnlimitedStorage) {
      storageLimitBytes = -1;
    } else if (selectedQuotaOption === "custom") {
      const amountNumber = Number(storageLimitAmount);
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        alert("Please enter a valid storage amount greater than 0");
        return;
      }
      storageLimitBytes = Math.round(amountNumber * BYTES_IN_UNIT[storageLimitUnit]);
    } else {
      const selectedPreset = STORAGE_QUOTA_OPTIONS.find(
        (option) => option.key === selectedQuotaOption,
      );
      if (!selectedPreset) {
        alert("Please select a valid storage quota");
        return;
      }
      storageLimitBytes = selectedPreset.bytes;
    }

    try {
      await updateUserStorageLimit(selectedUser._id, storageLimitBytes);
      setShowStorageModal(false);
      setSelectedUser(null);
      setSelectedQuotaOption("10GB");
      setIsUnlimitedStorage(false);
      setStorageLimitAmount("");
      setStorageLimitUnit("GB");
      logger.info("User storage limit updated", {
        userId: selectedUser._id,
        storageLimitBytes,
      });
    } catch (error) {
      logger.error("Failed to update user storage limit", {
        error: error.message,
        userId: selectedUser._id,
        storageLimitBytes,
      });
      alert(error.response?.data?.error || "Failed to update storage limit");
    }
  };

  const handleDeleteUser = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    try {
      await deleteUser(selectedUser._id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      logger.info("User deleted", { userId: selectedUser._id });
    } catch (error) {
      logger.error("Failed to delete user", {
        error: error.message,
        userId: selectedUser._id,
      });
      alert(error.response?.data?.error || "Failed to delete user");
    }
  };

  const handlePageChange = (newPage) => {
    loadUsers({ page: newPage });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "admin":
        return styles.roleAdmin;
      case "family":
        return styles.roleFamily;
      case "guest":
        return styles.roleGuest;
      case "user":
        return styles.roleUser;
      default:
        return "";
    }
  };

  const getQuotaStatus = (user) => {
    const defaultLimit = ROLE_DEFAULT_STORAGE_LIMITS[user.role];

    if (defaultLimit !== undefined && user.storageLimit === defaultLimit) {
      return { label: "Default", className: styles.quotaDefault };
    }

    if (user.storageLimit === -1) {
      return { label: "Unlimited", className: styles.quotaUnlimited };
    }

    return { label: "Custom", className: styles.quotaCustom };
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Users size={28} />
            User Management
          </h1>
          <p className={styles.subtitle}>
            Manage users, roles, and permissions
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionButton}
            onClick={() => loadUsers()}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            className={styles.exportButton}
            onClick={handleExportUsers}
            disabled={isExporting || users.length === 0}
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            className={styles.backButton}
            onClick={() => navigate("/admin")}
          >
            <ChevronLeft size={18} />
            Back
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#e0f2fe" }}
          >
            <Users size={24} color="#0284c7" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.total}</div>
            <div className={styles.statLabel}>Total Users</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#dcfce7" }}
          >
            <Shield size={24} color="#16a34a" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.admins}</div>
            <div className={styles.statLabel}>Admins</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#fef3c7" }}
          >
            <UserCheck size={24} color="#ca8a04" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.family}</div>
            <div className={styles.statLabel}>Family</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#fee2e2" }}
          >
            <UserX size={24} color="#dc2626" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.guests}</div>
            <div className={styles.statLabel}>Guests</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#f3e8ff" }}
          >
            <HardDrive size={24} color="#9333ea" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>
              {formatFileSize(statistics.totalStorage)}
            </div>
            <div className={styles.statLabel}>Total Storage</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIcon}
            style={{ backgroundColor: "#fce7f3" }}
          >
            <FileText size={24} color="#db2777" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statistics.totalFiles}</div>
            <div className={styles.statLabel}>Total Files</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={styles.controls}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <select
              className={styles.filterSelect}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                loadUsers({ page: 1, role: e.target.value });
              }}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="family">Family</option>
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                loadUsers({ page: 1, sortBy: e.target.value });
              }}
            >
              <option value="createdAt">Date Created</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="storageUsed">Storage Used</option>
            </select>
          </div>

          <button
            className={styles.sortOrderButton}
            onClick={() => {
              const newOrder = sortOrder === "asc" ? "desc" : "asc";
              setSortOrder(newOrder);
              loadUsers({ page: 1, sortOrder: newOrder });
            }}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Users List */}
      {loading && !users.length ? (
        <div className={styles.loading}>Loading users...</div>
      ) : users.length === 0 ? (
        <div className={styles.empty}>No users found</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Quota Plan</th>
                    <th>Storage Used</th>
                    <th>Files</th>
                    <th>Member Since</th>
                    <th className={styles.actionsColumn}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td data-label="User">
                        <div className={styles.userCell}>
                          <div
                            className={styles.userAvatar}
                            style={{
                              backgroundColor: getAvatarColor(user.name),
                            }}
                          >
                            {getUserInitials(user.name)}
                          </div>
                          <div className={styles.userInfo}>
                            <div className={styles.userName}>{user.name}</div>
                            <div className={styles.userEmail}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Role">
                        <span
                          className={`${styles.roleBadge} ${getRoleBadgeClass(
                            user.role,
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td data-label="Quota Plan">
                        <span
                          className={`${styles.quotaBadge} ${getQuotaStatus(user).className}`}
                        >
                          {getQuotaStatus(user).label}
                        </span>
                      </td>
                      <td data-label="Storage Used">
                        <div className={styles.storageCell}>
                          <div className={styles.storageValue}>
                            {formatFileSize(user.storageUsed)}
                          </div>
                          {user.storageLimit !== -1 && (
                            <div className={styles.storageLimit}>
                              of {formatFileSize(user.storageLimit)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Files">{user.fileCount || 0}</td>
                      <td data-label="Member Since">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className={styles.actionsColumn} data-label="Actions">
                        <div className={styles.actions}>
                          <button
                            className={styles.actionButton}
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role);
                              handleRoleChange();
                            }}
                            title={
                              user.role === "guest"
                                ? "Guest role cannot be changed"
                                : "Change Role"
                            }
                            disabled={user.role === "guest"}
                            style={
                              user.role === "guest"
                                ? { opacity: 0.5, cursor: "not-allowed" }
                                : {}
                            }
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className={styles.actionButton}
                            onClick={() => {
                              setSelectedUser(user);
                              handleStorageLimitChange(user);
                            }}
                            title={
                              user.role === "guest"
                                ? "Guest storage cannot be changed"
                                : "Update Storage Limit"
                            }
                            disabled={user.role === "guest"}
                            style={
                              user.role === "guest"
                                ? { opacity: 0.5, cursor: "not-allowed" }
                                : {}
                            }
                          >
                            <HardDrive size={16} />
                          </button>
                          {user._id !== currentUser.id && (
                            <button
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              onClick={() => {
                                setSelectedUser(user);
                                handleDeleteUser();
                              }}
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {usersPagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(usersPagination.page - 1)}
                disabled={usersPagination.page === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <div className={styles.paginationInfo}>
                Page {usersPagination.page} of {usersPagination.totalPages} •{" "}
                {usersPagination.total} total users
              </div>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(usersPagination.page + 1)}
                disabled={usersPagination.page === usersPagination.totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className={styles.modal} onClick={() => setShowRoleModal(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Change User Role</h2>
            <p className={styles.modalDescription}>
              Change role for <strong>{selectedUser.name}</strong>
            </p>

            <div className={styles.roleOptions}>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={newRole === "admin"}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <div className={styles.roleOptionInfo}>
                  <div className={styles.roleOptionName}>Admin</div>
                  <div className={styles.roleOptionDesc}>
                    Full system access, unlimited storage
                  </div>
                </div>
              </label>

              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="family"
                  checked={newRole === "family"}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <div className={styles.roleOptionInfo}>
                  <div className={styles.roleOptionName}>Family</div>
                  <div className={styles.roleOptionDesc}>
                    Standard user with unlimited storage
                  </div>
                </div>
              </label>

              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="user"
                  checked={newRole === "user"}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <div className={styles.roleOptionInfo}>
                  <div className={styles.roleOptionName}>User</div>
                  <div className={styles.roleOptionDesc}>
                    Standard user with 5GB storage limit
                  </div>
                </div>
              </label>

              <label
                className={styles.roleOption}
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                <input
                  type="radio"
                  name="role"
                  value="guest"
                  checked={newRole === "guest"}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={true}
                />
                <div className={styles.roleOptionInfo}>
                  <div className={styles.roleOptionName}>
                    Guest (Automatic only)
                  </div>
                  <div className={styles.roleOptionDesc}>
                    Temporary user with 500MB storage limit
                  </div>
                </div>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowRoleModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={confirmRoleChange}
                disabled={!newRole || newRole === selectedUser.role}
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Limit Modal */}
      {showStorageModal && selectedUser && (
        <div
          className={styles.modal}
          onClick={() => {
            setShowStorageModal(false);
            setSelectedQuotaOption("10GB");
            setIsUnlimitedStorage(false);
            setStorageLimitAmount("");
            setStorageLimitUnit("GB");
          }}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Update Storage Limit</h2>
            <p className={styles.modalDescription}>
              Set a new storage limit for <strong>{selectedUser.name}</strong>
            </p>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Predefined Quotas</label>
              <div className={styles.quotaOptionsGrid}>
                {STORAGE_QUOTA_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.quotaOptionButton} ${
                      selectedQuotaOption === option.key && !isUnlimitedStorage
                        ? styles.quotaOptionActive
                        : ""
                    }`}
                    onClick={() => {
                      setIsUnlimitedStorage(false);
                      setSelectedQuotaOption(option.key);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.quotaOptionButton} ${
                    selectedQuotaOption === "custom" && !isUnlimitedStorage
                      ? styles.quotaOptionActive
                      : ""
                  }`}
                  onClick={() => {
                    setIsUnlimitedStorage(false);
                    setSelectedQuotaOption("custom");
                    if (!storageLimitAmount) {
                      setStorageLimitAmount("10");
                    }
                  }}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="storage-limit-input">
                Storage Amount
              </label>
              <div className={styles.storageInputGroup}>
                <input
                  id="storage-limit-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={styles.storageInput}
                  value={storageLimitAmount}
                  onChange={(e) => setStorageLimitAmount(e.target.value)}
                  placeholder="Enter amount"
                  disabled={selectedQuotaOption !== "custom" || isUnlimitedStorage}
                />
                <select
                  className={styles.storageUnitSelect}
                  value={storageLimitUnit}
                  onChange={(e) => setStorageLimitUnit(e.target.value)}
                  disabled={selectedQuotaOption !== "custom" || isUnlimitedStorage}
                >
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                  <option value="TB">TB</option>
                </select>
              </div>

              <label className={styles.unlimitedCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={isUnlimitedStorage}
                  onChange={(e) => setIsUnlimitedStorage(e.target.checked)}
                />
                Set Unlimited
              </label>

              <p className={styles.helperText}>
                Current limit: {" "}
                {selectedUser.storageLimit === -1
                  ? "Unlimited"
                  : formatFileSize(selectedUser.storageLimit)}
              </p>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => {
                  setShowStorageModal(false);
                  setSelectedQuotaOption("10GB");
                  setIsUnlimitedStorage(false);
                  setStorageLimitAmount("");
                  setStorageLimitUnit("GB");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.modalButtonPrimary}
                onClick={confirmStorageLimitChange}
                disabled={
                  !isUnlimitedStorage &&
                  selectedQuotaOption === "custom" &&
                  (!storageLimitAmount || Number(storageLimitAmount) <= 0)
                }
              >
                Update Storage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className={styles.modal} onClick={() => setShowDeleteModal(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Delete User</h2>
            <p className={styles.modalDescription}>
              Are you sure you want to delete{" "}
              <strong>{selectedUser.name}</strong>? This will permanently
              delete:
            </p>
            <ul className={styles.deleteWarningList}>
              <li>User account</li>
              <li>All files and folders</li>
              <li>All upload sessions</li>
            </ul>
            <p className={styles.modalWarning}>This action cannot be undone.</p>

            <div className={styles.modalActions}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className={`${styles.modalButtonPrimary} ${styles.deleteButtonPrimary}`}
                onClick={confirmDelete}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
