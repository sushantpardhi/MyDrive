import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or default to 'light'
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme || "light";
  });

  // Apply theme to document root when theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const setLightTheme = () => {
    setThemeState("light");
  };

  const setDarkTheme = () => {
    setThemeState("dark");
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isDark: theme === "dark",
    isLight: theme === "light",
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
