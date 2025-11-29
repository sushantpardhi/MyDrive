import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export const useUserSettings = () => {
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load user settings from backend and sync viewMode
  useEffect(() => {
    async function syncSettings() {
      try {
        setLoading(true);
        const res = await api.getUserProfile();

        if (res.data?.preferences?.viewMode) {
          setViewMode(res.data.preferences.viewMode);
        }
      } catch (err) {
        // Keep local settings as fallback
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }

    // Only sync if we have a token (user is logged in)
    const token = localStorage.getItem("token");
    if (token) {
      syncSettings();
    } else {
      setInitialized(true);
      setLoading(false);
    }
  }, []);

  // Update backend when viewMode changes
  const updateSettings = useCallback(
    async (newViewMode) => {
      try {
        const user = await api.getUserProfile();
        await api.updateUserProfile({
          preferences: {
            ...user.data.preferences,
            viewMode: newViewMode || viewMode,
          },
        });
      } catch (err) {
        console.error("Failed to update settings:", err);
      }
    },
    [viewMode]
  );

  const changeViewMode = useCallback(
    (mode) => {
      setViewMode(mode);
      updateSettings(mode);
    },
    [updateSettings]
  );

  return {
    viewMode,
    changeViewMode,
    loading,
    initialized,
  };
};
