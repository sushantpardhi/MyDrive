import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useUserSettings } from "../../hooks/useUserSettings";
import styles from "./UserProfile.module.css";

const defaultSettings = {
  notifications: true,
  language: "en",
};
const defaultPreferences = {
  viewMode: "list",
  itemsPerPage: 20,
};

export default function UserProfile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    settings: defaultSettings,
    preferences: defaultPreferences,
  });
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(profile);
  const [error, setError] = useState(null);

  // Use user settings for live updates
  const { changeViewMode } = useUserSettings();

  useEffect(() => {
    async function fetchProfile() {
      try {
        setError(null);
        const res = await api.getUserProfile();
        const profileData = {
          ...res.data,
          settings: { ...defaultSettings, ...res.data.settings },
          preferences: { ...defaultPreferences, ...res.data.preferences },
        };
        setProfile(profileData);
        setForm(profileData);
      } catch (err) {
        console.error("Error fetching profile:", err);
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
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setError(null);
      const res = await api.updateUserProfile({
        name: form.name,
        settings: form.settings,
        preferences: form.preferences,
      });
      setProfile(res.data.user);
      setEditMode(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to update profile"
      );
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
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
            <div className={styles.avatar}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{form.name || "User"}</div>
              <div className={styles.profileEmail}>
                {form.email || "No email"}
              </div>
            </div>
          </div>
          <form onSubmit={handleSave} className={styles.profileForm}>
            <div className={styles.sectionCard}>
              <h3>Personal Information</h3>
              <div className={styles.formRow}>
                <label htmlFor="name">Name:</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editMode}
                />
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
            <div className={styles.sectionCard}>
              <h3>Settings</h3>
              <div className={styles.formRow}>
                <label htmlFor="notifications">Notifications:</label>
                <input
                  id="notifications"
                  type="checkbox"
                  name="settings.notifications"
                  checked={form.settings.notifications}
                  onChange={handleChange}
                  disabled={!editMode}
                />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="language">Language:</label>
                <select
                  id="language"
                  name="settings.language"
                  value={form.settings.language}
                  onChange={handleChange}
                  disabled={!editMode}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
            <div className={styles.sectionCard}>
              <h3>Preferences</h3>
              <div className={styles.formRow}>
                <label htmlFor="viewMode">View Mode:</label>
                <select
                  id="viewMode"
                  name="preferences.viewMode"
                  value={form.preferences.viewMode}
                  onChange={handleChange}
                  disabled={!editMode}
                >
                  <option value="list">List</option>
                  <option value="grid">Grid</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="itemsPerPage">Items Per Page:</label>
                <input
                  id="itemsPerPage"
                  type="number"
                  name="preferences.itemsPerPage"
                  value={form.preferences.itemsPerPage}
                  onChange={handleChange}
                  disabled={!editMode}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <div className={styles.profileActions}>
              <div className={styles.actionGroup}>
                {editMode ? (
                  <>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => {
                        setEditMode(false);
                        setForm(profile);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={styles.saveBtn}>
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </button>
                )}
              </div>
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
          </form>
        </div>
      </div>
    </div>
  );
}
