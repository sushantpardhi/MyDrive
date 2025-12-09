import { useEffect, useState } from "react";
import {
  Upload,
  Trash2,
  Shield,
  Activity,
  AlertTriangle,
  Calendar,
  HardDrive,
  File,
  Folder,
  Share2,
  Lock,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import api from "../../services/api";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { useTheme, useAuth } from "../../contexts";
import LoadingSpinner from "../common/LoadingSpinner";
import logger from "../../utils/logger";
import styles from "./UserProfile.module.css";
import { getUserInitials, getAvatarColor } from "../../utils/helpers";

const defaultSettings = {
  emailNotifications: true,
  language: "en",
  theme: "light",
};
const defaultPreferences = {
  viewMode: "list",
  itemsPerPage: 25,
};

export default function UserProfile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    createdAt: null,
    settings: defaultSettings,
    preferences: defaultPreferences,
  });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(profile);
  const [error, setError] = useState(null);
  const [storageStats, setStorageStats] = useState(null);

  // Individual field saving states
  const [savingFields, setSavingFields] = useState({
    name: false,
    emailNotifications: false,
    language: false,
    viewMode: false,
    itemsPerPage: false,
  });
  const [savedFields, setSavedFields] = useState({
    name: false,
    emailNotifications: false,
    language: false,
    viewMode: false,
    itemsPerPage: false,
  });
  const [accountStats, setAccountStats] = useState(null);
  const [activityLog, setActivityLog] = useState([]);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState(null);

  // Use user settings for live updates
  const { changeViewMode, changeItemsPerPage } = useUserSettings();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    async function fetchProfile() {
      try {
        setError(null);
        logger.info("Fetching user profile data");

        // Fetch all data in parallel
        const [profileRes, storageRes, statsRes] = await Promise.all([
          api.getUserProfile(),
          api.getStorageStats(),
          api.getAccountStats(),
        ]);

        const profileData = {
          ...profileRes.data,
          settings: { ...defaultSettings, ...profileRes.data.settings },
          preferences: {
            ...defaultPreferences,
            ...profileRes.data.preferences,
          },
        };
        setProfile(profileData);
        setForm(profileData);
        setStorageStats(storageRes.data);
        setAccountStats(statsRes.data);

        // Sync theme from user settings
        if (profileData.settings.theme) {
          setTheme(profileData.settings.theme);
        }

        logger.info("Profile data loaded successfully", {
          userId: profileData._id,
        });
      } catch (err) {
        logger.error("Error fetching profile", {
          error: err.message,
          stack: err.stack,
        });
        setError(
          err.response?.data?.error || err.message || "Failed to fetch profile"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (name.startsWith("settings.")) {
      const settingName = name.split(".")[1];
      const newValue = type === "checkbox" ? checked : value;

      setForm((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingName]: newValue,
        },
      }));

      // Auto-save for settings
      if (settingName === "emailNotifications" || settingName === "language") {
        handleFieldSave(settingName, newValue, "settings");
      }
    } else if (name.startsWith("preferences.")) {
      const prefName = name.split(".")[1];
      const newValue = type === "number" ? Number(value) : value;

      setForm((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefName]: newValue,
        },
      }));

      // Immediately apply view mode changes for live preview
      if (prefName === "viewMode") {
        changeViewMode(newValue);
      }

      // Immediately apply itemsPerPage changes
      if (prefName === "itemsPerPage") {
        changeItemsPerPage(newValue);
      }

      // Auto-save for preferences
      handleFieldSave(prefName, newValue, "preferences");
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  // Individual field save handler
  async function handleFieldSave(fieldName, value, category = null) {
    try {
      setSavingFields((prev) => ({ ...prev, [fieldName]: true }));
      setSavedFields((prev) => ({ ...prev, [fieldName]: false }));

      logger.info("Saving field", { fieldName, category });

      const updateData = {
        name: form.name,
        settings: form.settings,
        preferences: form.preferences,
      };

      // Update the specific field
      if (category === "settings") {
        updateData.settings = { ...form.settings, [fieldName]: value };
      } else if (category === "preferences") {
        updateData.preferences = { ...form.preferences, [fieldName]: value };
      } else {
        updateData[fieldName] = value;
      }

      const res = await api.updateUserProfile(updateData);
      setProfile(res.data.user);

      setSavingFields((prev) => ({ ...prev, [fieldName]: false }));
      setSavedFields((prev) => ({ ...prev, [fieldName]: true }));

      // Hide check mark after 2 seconds
      setTimeout(() => {
        setSavedFields((prev) => ({ ...prev, [fieldName]: false }));
      }, 2000);

      logger.info("Field saved successfully", { fieldName });
    } catch (err) {
      logger.error("Error saving field", { fieldName, error: err.message });
      setSavingFields((prev) => ({ ...prev, [fieldName]: false }));
      setError(
        err.response?.data?.error || err.message || "Failed to save changes"
      );
    }
  }

  // Handle name field blur (save on blur)
  async function handleNameBlur() {
    if (form.name !== profile.name && form.name.trim()) {
      await handleFieldSave("name", form.name);
    }
  }

  function handleThemeChange(e) {
    const newTheme = e.target.value;
    setTheme(newTheme);
    setForm((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: newTheme,
      },
    }));

    // Show saving state
    setSavingFields((prev) => ({ ...prev, theme: true }));

    // Auto-save theme change
    saveThemeToServer(newTheme);
  }

  async function saveThemeToServer(newTheme) {
    try {
      await api.updateUserProfile({
        name: form.name,
        settings: { ...form.settings, theme: newTheme },
        preferences: form.preferences,
      });

      // Show success checkmark
      setSavingFields((prev) => ({ ...prev, theme: false }));
      setSavedFields((prev) => ({ ...prev, theme: true }));
      setTimeout(() => {
        setSavedFields((prev) => ({ ...prev, theme: false }));
      }, 2000);
    } catch (err) {
      logger.error("Error saving theme", { error: err.message });
      // Revert on error
      setTheme(form.settings.theme);
      setSavingFields((prev) => ({ ...prev, theme: false }));
    }
  }

  // Password change handlers
  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      logger.info("Attempting to change password");
      await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      logger.info("Password changed successfully");
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      logger.error("Password change failed", { error: err.message });
      setPasswordError(
        err.response?.data?.error || "Failed to change password"
      );
    }
  }

  // Delete account handler
  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError("Please enter your password");
      return;
    }

    try {
      setDeleteError(null);
      logger.warn("Attempting account deletion", { userId: profile._id });
      await api.deleteAccount(deletePassword);
      logger.info("Account deleted successfully");
      api.logout();
      window.location.href = "/register";
    } catch (err) {
      logger.error("Account deletion failed", { error: err.message });
      setDeleteError(err.response?.data?.error || "Failed to delete account");
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" message="Loading profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.profileWrapper}>
        <div className={styles.profileContainer}>
          <div className={styles.errorCard}>
            <h3>Error Loading Profile</h3>
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className={styles.retryBtn}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileWrapper}>
      <div className={styles.profileContainer}>
        <div className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatarWrapper}>
              <div
                className={styles.avatar}
                style={{ backgroundColor: getAvatarColor(profile.name) }}
              >
                {getUserInitials(profile.name)}
              </div>
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{form.name || "User"}</div>
              <div className={styles.profileEmail}>
                {form.email || "No email"}
              </div>
              {profile.role && (
                <div className={styles.profileRole}>
                  <Shield size={14} />
                  <span className={styles[`role-${profile.role}`]}>
                    {profile.role.charAt(0).toUpperCase() +
                      profile.role.slice(1)}
                  </span>
                </div>
              )}
              {profile.createdAt && (
                <div className={styles.profileDate}>
                  <Calendar size={14} />
                  <span>Joined {formatDate(profile.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.profileForm}>
            {/* Storage Usage Section - Full Width */}
            {storageStats && (
              <div className={styles.sectionCard}>
                <h3>
                  <HardDrive size={16} />
                  Storage Usage
                </h3>
                <div className={styles.storageInfo}>
                  <div className={styles.storageStats}>
                    <span className={styles.storageUsed}>
                      {formatFileSize(storageStats.storageUsed)}
                    </span>
                    {storageStats.isUnlimited ? (
                      <>
                        <span className={styles.storageSeparator}></span>
                        <span className={styles.storageTotal}>Unlimited</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.storageSeparator}>/</span>
                        <span className={styles.storageTotal}>
                          {formatFileSize(storageStats.storageLimit)}
                        </span>
                        <span className={styles.storagePercent}>
                          ({storageStats.percentage.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                  {!storageStats.isUnlimited && (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${Math.min(storageStats.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account Statistics Section - Full Width */}
            {accountStats && (
              <div className={styles.sectionCard}>
                <h3>
                  <Activity size={16} />
                  Account Statistics
                </h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <File size={20} />
                    <div className={styles.statInfo}>
                      <span className={styles.statValue}>
                        {accountStats.filesCount || 0}
                      </span>
                      <span className={styles.statLabel}>Files</span>
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <Folder size={20} />
                    <div className={styles.statInfo}>
                      <span className={styles.statValue}>
                        {accountStats.foldersCount || 0}
                      </span>
                      <span className={styles.statLabel}>Folders</span>
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <Share2 size={20} />
                    <div className={styles.statInfo}>
                      <span className={styles.statValue}>
                        {accountStats.sharedItemsCount || 0}
                      </span>
                      <span className={styles.statLabel}>Shared</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Information Section - Full Width */}
            <div className={styles.sectionCard}>
              <h3>Personal Information</h3>
              <div className={styles.formRow}>
                <label htmlFor="name">Name:</label>
                <div className={styles.inputWithIcon}>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    onBlur={handleNameBlur}
                    placeholder="Enter your name"
                  />
                  {savedFields.name && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  disabled
                  style={{ background: "#f7fafc", cursor: "not-allowed" }}
                />
              </div>
            </div>

            {/* Settings Section - Full Width */}
            <div className={styles.sectionCard}>
              <h3>Settings</h3>
              <div className={styles.formRow}>
                <label htmlFor="emailNotifications">Email Notifications:</label>
                <div className={styles.inputWithIcon}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      flex: 1,
                    }}
                  >
                    <input
                      id="emailNotifications"
                      type="checkbox"
                      name="settings.emailNotifications"
                      checked={form.settings.emailNotifications}
                      onChange={handleChange}
                    />
                    <small style={{ color: "#666", fontSize: "12px" }}>
                      Receive email alerts for file shares and storage warnings
                    </small>
                  </div>
                  {savedFields.emailNotifications && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="language">Language:</label>
                <div className={styles.inputWithIcon}>
                  <select
                    id="language"
                    name="settings.language"
                    value={form.settings.language}
                    onChange={handleChange}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                  {savedFields.language && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Preferences Section - Full Width (includes Appearance) */}
            <div className={styles.sectionCard}>
              <h3>Preferences</h3>
              <div className={styles.formRow}>
                <label htmlFor="theme">Theme:</label>
                <div className={styles.inputWithIcon}>
                  <select
                    id="theme"
                    name="settings.theme"
                    value={theme}
                    onChange={handleThemeChange}
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                  {savedFields.theme && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="viewMode">View Mode:</label>
                <div className={styles.inputWithIcon}>
                  <select
                    id="viewMode"
                    name="preferences.viewMode"
                    value={form.preferences.viewMode}
                    onChange={handleChange}
                  >
                    <option value="list">List</option>
                    <option value="grid">Grid</option>
                  </select>
                  {savedFields.viewMode && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="itemsPerPage">Items Per Page:</label>
                <div className={styles.inputWithIcon}>
                  <select
                    id="itemsPerPage"
                    name="preferences.itemsPerPage"
                    value={form.preferences.itemsPerPage}
                    onChange={handleChange}
                  >
                    <option value={25}>25 items</option>
                    <option value={50}>50 items</option>
                    <option value={75}>75 items</option>
                    <option value={100}>100 items</option>
                  </select>
                  {savedFields.itemsPerPage && (
                    <Check
                      size={18}
                      className={styles.checkIcon}
                      style={{ color: "#10b981" }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Password Change Section */}
            <div className={styles.sectionCard}>
              <h3>
                <Lock size={16} />
                Change Password
              </h3>
              {passwordSuccess && (
                <div className={styles.successMessage}>
                  Password changed successfully!
                </div>
              )}
              {passwordError && (
                <div className={styles.errorMessage}>{passwordError}</div>
              )}
              <div className={styles.passwordForm}>
                <div className={styles.formRow}>
                  <label htmlFor="currentPassword">Current Password:</label>
                  <div className={styles.passwordInput}>
                    <input
                      id="currentPassword"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          current: !prev.current,
                        }))
                      }
                    >
                      {showPasswords.current ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="newPassword">New Password:</label>
                  <div className={styles.passwordInput}>
                    <input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      placeholder="Enter new password (min 6 chars)"
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          new: !prev.new,
                        }))
                      }
                    >
                      {showPasswords.new ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <label htmlFor="confirmPassword">Confirm Password:</label>
                  <div className={styles.passwordInput}>
                    <input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          confirm: !prev.confirm,
                        }))
                      }
                    >
                      {showPasswords.confirm ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordChange}
                  className={styles.changePasswordBtn}
                  disabled={
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                >
                  Change Password
                </button>
              </div>
            </div>

            {/* Security Section */}
            <div className={styles.sectionCard}>
              <h3>
                <Shield size={16} />
                Security
              </h3>
              <div className={styles.formRow}>
                <label htmlFor="twoFactor">Two-Factor Authentication:</label>
                <div className={styles.securityOption}>
                  <span className={styles.comingSoon}>Coming Soon</span>
                  <small style={{ color: "#666", fontSize: "12px" }}>
                    Add an extra layer of security to your account
                  </small>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className={styles.dangerZone}>
              <h3>
                <AlertTriangle size={16} />
                Danger Zone
              </h3>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className={styles.dangerBtn}
                >
                  Delete Account
                </button>
              ) : (
                <div className={styles.deleteConfirm}>
                  <p className={styles.dangerWarning}>
                    ⚠️ This action cannot be undone. All your files and data
                    will be permanently deleted.
                  </p>
                  {deleteError && (
                    <div className={styles.errorMessage}>{deleteError}</div>
                  )}
                  <div className={styles.formRow}>
                    <label htmlFor="deletePassword">
                      Enter your password to confirm:
                    </label>
                    <input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                    />
                  </div>
                  <div className={styles.deleteActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                        setDeleteError(null);
                      }}
                      className={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className={styles.confirmDeleteBtn}
                      disabled={!deletePassword}
                    >
                      Permanently Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.profileActions}>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={() => {
                  api.logout();
                  window.location.href = "/login";
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
