import { createContext, useContext, useState, useEffect } from "react";

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
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
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
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearUserSettings();
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
