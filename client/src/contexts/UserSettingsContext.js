import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import api from "../services/api";

const UserSettingsContext = createContext();

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error(
      "useUserSettings must be used within a UserSettingsProvider"
    );
  }
  return context;
};

export const UserSettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch user settings from backend when user logs in or changes
  useEffect(() => {
    async function fetchSettings() {
      if (!user) {
        // User logged out, reset to defaults
        console.log("[UserSettings] User logged out, resetting to defaults");
        setViewMode("grid");
        setTheme("light");
        setLoading(false);
        setInitialized(true);
        localStorage.removeItem("viewMode");
        localStorage.removeItem("theme");
        return;
      }

      console.log("[UserSettings] Fetching settings for user:", user.id);
      try {
        setLoading(true);
        setInitialized(false);

        const res = await api.getUserProfile();

        // Apply theme from settings.theme
        if (res.data?.settings?.theme) {
          console.log(
            "[UserSettings] Loaded theme from backend:",
            res.data.settings.theme
          );
          setTheme(res.data.settings.theme);
        } else {
          console.log("[UserSettings] No backend theme, using default: light");
          setTheme("light");
        }

        // Apply viewMode from preferences.viewMode
        if (res.data?.preferences?.viewMode) {
          console.log(
            "[UserSettings] Loaded viewMode from backend:",
            res.data.preferences.viewMode
          );
          setViewMode(res.data.preferences.viewMode);
          localStorage.setItem("viewMode", res.data.preferences.viewMode);
        } else {
          // No backend preference, use default
          console.log(
            "[UserSettings] No backend preference, using default: grid"
          );
          setViewMode("grid");
          localStorage.setItem("viewMode", "grid");
        }
      } catch (err) {
        console.error("[UserSettings] Failed to fetch user settings:", err);
        // On error, try localStorage fallback
        const savedViewMode = localStorage.getItem("viewMode");
        const savedTheme = localStorage.getItem("theme");
        setViewMode(savedViewMode || "grid");
        setTheme(savedTheme || "light");
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }

    fetchSettings();
  }, [user?.id, setTheme]); // Re-fetch when user ID changes

  // Update backend when viewMode changes
  const updateSettings = useCallback(async (newViewMode) => {
    try {
      const userProfile = await api.getUserProfile();
      await api.updateUserProfile({
        preferences: {
          ...userProfile.data.preferences,
          viewMode: newViewMode,
        },
      });
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  }, []);

  const changeViewMode = useCallback(
    (mode) => {
      setViewMode(mode);
      localStorage.setItem("viewMode", mode);
      updateSettings(mode);
    },
    [updateSettings]
  );

  const value = {
    viewMode,
    changeViewMode,
    loading,
    initialized,
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
