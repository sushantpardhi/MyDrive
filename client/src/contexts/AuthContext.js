import { createContext, useContext, useState, useEffect } from "react";
import logger from "../utils/logger";

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
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      const userData = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(userData);
      logger.info("User session restored from localStorage", {
        userId: userData.id,
      });
    } else {
      logger.debug("No stored session found");
    }
    setLoading(false);
  }, []);

  const login = (userData, userToken) => {
    // Clear previous user's settings before setting new user
    clearUserSettings();

    setUser(userData);
    setToken(userToken);
    localStorage.setItem("token", userToken);
    localStorage.setItem("user", JSON.stringify(userData));

    logger.logAuth("login", userData.id, "User logged in successfully");
  };

  const logout = () => {
    const userId = user?.id;
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearUserSettings();

    logger.logAuth("logout", userId, "User logged out");
  };

  const isAuthenticated = () => {
    return !!token;
  };

  const clearUserSettings = () => {
    // Clear all user-specific settings from localStorage
    localStorage.removeItem("viewMode");
    localStorage.removeItem("theme");
    localStorage.removeItem("lastFolderId");
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    clearUserSettings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
