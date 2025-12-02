import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts";
import api from "../services/api";

export const useUserSettings = () => {
  const { user } = useAuth();

  // Load viewMode from localStorage on init
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem("viewMode");
    return saved || "grid";
  });
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
          localStorage.setItem("viewMode", res.data.preferences.viewMode);
        } else {
          // If no backend preference, reset to default
          setViewMode("grid");
          localStorage.setItem("viewMode", "grid");
        }
      } catch (err) {
        // Keep local settings as fallback
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }

    // Only sync if user is logged in
    if (user) {
      setInitialized(false);
      syncSettings();
    } else {
      setInitialized(true);
      setLoading(false);
    }
  }, [user?.id]);

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
      localStorage.setItem("viewMode", mode);
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
