import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts";
import api from "../services/api";

export const useUserSettings = () => {
  const { user } = useAuth();

  // Initialize viewMode as loading state (don't load from localStorage immediately)
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load user settings from backend on mount and when user changes
  useEffect(() => {
    async function syncSettings() {
      try {
        setLoading(true);
        const res = await api.getUserProfile();

        if (res.data?.preferences?.viewMode) {
          setViewMode(res.data.preferences.viewMode);
          localStorage.setItem("viewMode", res.data.preferences.viewMode);
        } else {
          // If no backend preference, use default
          setViewMode("grid");
          localStorage.setItem("viewMode", "grid");
        }
      } catch (err) {
        // On error, try to use localStorage as fallback
        const saved = localStorage.getItem("viewMode");
        setViewMode(saved || "grid");
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
      // No user logged in, reset to default
      setViewMode("grid");
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
