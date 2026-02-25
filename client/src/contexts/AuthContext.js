import { createContext, useContext, useState, useEffect } from "react";
import logger from "../utils/logger";
import api from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Hit the backend to confirm the HTTP-only cookie is valid
        const response = await api.getCurrentUser();
        setUser(response.data);
        localStorage.setItem("user", JSON.stringify(response.data));
        logger.info("User session verified via cookie", {
          userId: response.data._id || response.data.id,
        });
      } catch (error) {
        // If unauthorized or no cookie, clear the session state
        setUser(null);
        localStorage.removeItem("user");
        logger.debug("No valid stored session found");
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = (userData) => {
    // Clear previous user's settings before setting new user
    clearUserSettings();

    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));

    logger.logAuth("login", userData.id, {
      message: "User logged in successfully",
      role: userData.role,
    });
  };

  const logout = async () => {
    const userId = user?.id;

    // Call server logout to clear cookies
    await api.logout();

    setUser(null);
    clearUserSettings();

    logger.logAuth("logout", userId, "User logged out");
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    logger.debug("User state updated", { userId: userData.id });
  };

  const isAuthenticated = () => {
    return !!user || !!localStorage.getItem("user");
  };

  const clearUserSettings = () => {
    // Clear all user-specific settings from localStorage
    localStorage.removeItem("viewMode");
    localStorage.removeItem("theme");
    localStorage.removeItem("lastFolderId");
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated,
    clearUserSettings,
    isAdmin: () => user?.role === "admin",
    isFamily: () => user?.role === "family",
    isGuest: () => user?.role === "guest",
    hasUnlimitedStorage: () =>
      user?.role === "admin" || user?.role === "family",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
