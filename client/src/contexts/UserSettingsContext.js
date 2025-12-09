import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import api from "../services/api";
import logger from "../utils/logger";

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
  const setThemeRef = useRef(setTheme);
  const [viewMode, setViewMode] = useState("grid");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Keep setTheme ref up to date
  useEffect(() => {
    setThemeRef.current = setTheme;
  }, [setTheme]);

  // Fetch user settings from backend when user logs in or changes
  useEffect(() => {
    async function fetchSettings() {
      if (!user) {
        // User logged out, reset to defaults
        logger.info("UserSettings: User logged out, resetting to defaults");
        setViewMode("grid");
        setItemsPerPage(25);
        setThemeRef.current("light");
        setLoading(false);
        setInitialized(true);
        localStorage.removeItem("viewMode");
        localStorage.removeItem("itemsPerPage");
        localStorage.removeItem("theme");
        return;
      }

      logger.info("UserSettings: Fetching settings for user", {
        userId: user.id,
      });
      try {
        setLoading(true);
        setInitialized(false);

        const res = await api.getUserProfile();

        // Apply theme from settings.theme
        if (res.data?.settings?.theme) {
          logger.info("UserSettings: Loaded theme from backend", {
            theme: res.data.settings.theme,
          });
          setThemeRef.current(res.data.settings.theme);
        } else {
          logger.debug("UserSettings: No backend theme, using default: light");
          setThemeRef.current("light");
        }

        // Apply viewMode from preferences.viewMode
        if (res.data?.preferences?.viewMode) {
          logger.info("UserSettings: Loaded viewMode from backend", {
            viewMode: res.data.preferences.viewMode,
          });
          setViewMode(res.data.preferences.viewMode);
          localStorage.setItem("viewMode", res.data.preferences.viewMode);
        } else {
          // No backend preference, use default
          logger.debug(
            "UserSettings: No backend preference, using default: grid"
          );
          setViewMode("grid");
          localStorage.setItem("viewMode", "grid");
        }

        // Apply itemsPerPage from preferences.itemsPerPage
        if (res.data?.preferences?.itemsPerPage) {
          logger.info("UserSettings: Loaded itemsPerPage from backend", {
            itemsPerPage: res.data.preferences.itemsPerPage,
          });
          setItemsPerPage(res.data.preferences.itemsPerPage);
          localStorage.setItem(
            "itemsPerPage",
            res.data.preferences.itemsPerPage.toString()
          );
        } else {
          // No backend preference, use default
          logger.debug(
            "UserSettings: No backend preference, using default: 25"
          );
          setItemsPerPage(25);
          localStorage.setItem("itemsPerPage", "25");
        }
      } catch (err) {
        logger.logError(err, "UserSettings: Failed to fetch user settings");
        // On error, try localStorage fallback
        const savedViewMode = localStorage.getItem("viewMode");
        const savedItemsPerPage = localStorage.getItem("itemsPerPage");
        const savedTheme = localStorage.getItem("theme");
        setViewMode(savedViewMode || "grid");
        setItemsPerPage(
          savedItemsPerPage ? parseInt(savedItemsPerPage, 10) : 25
        );
        setThemeRef.current(savedTheme || "light");
        logger.info("UserSettings: Using localStorage fallback", {
          viewMode: savedViewMode,
          itemsPerPage: savedItemsPerPage,
          theme: savedTheme,
        });
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }

    fetchSettings();
  }, [user?.id]); // Only re-fetch when user ID changes

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
      logger.info("UserSettings: Updated view mode", { viewMode: newViewMode });
    } catch (err) {
      logger.logError(err, "UserSettings: Failed to update settings");
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

  const changeItemsPerPage = useCallback(async (perPage) => {
    const numPerPage =
      typeof perPage === "string" ? parseInt(perPage, 10) : perPage;
    setItemsPerPage(numPerPage);
    localStorage.setItem("itemsPerPage", numPerPage.toString());
    try {
      const userProfile = await api.getUserProfile();
      await api.updateUserProfile({
        preferences: {
          ...userProfile.data.preferences,
          itemsPerPage: numPerPage,
        },
      });
      logger.info("UserSettings: Updated items per page", {
        itemsPerPage: numPerPage,
      });
    } catch (err) {
      logger.logError(err, "UserSettings: Failed to update itemsPerPage");
    }
  }, []);

  const value = {
    viewMode,
    itemsPerPage,
    changeViewMode,
    changeItemsPerPage,
    loading,
    initialized,
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
