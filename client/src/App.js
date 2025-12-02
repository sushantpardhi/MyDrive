import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/theme.css";
import Sidebar from "./components/layout/Sidebar.jsx";
import DriveView from "./components/drive/DriveView.jsx";
import Register from "./components/auth/Register.jsx";
import Login from "./components/auth/Login.jsx";
import ForgotPassword from "./components/auth/ForgotPassword.jsx";
import ResetPassword from "./components/auth/ResetPassword.jsx";
import UserProfile from "./components/auth/UserProfile.jsx";
import PreviewModal from "./components/files/PreviewModal.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DriveProvider } from "./contexts/DriveContext";
import { SelectionProvider } from "./contexts/SelectionContext";
import { UIProvider, useUIContext } from "./contexts/UIContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import styles from "./App.module.css";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

// Auth Route Component (redirects to drive if already logged in)
const AuthRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated() ? <Navigate to="/drive" replace /> : children;
};

// Main App Layout with contexts
const AppLayout = () => {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIContext();

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth <= 768) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [sidebarOpen]);

  return (
    <div className={styles.container}>
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
        <Sidebar onClose={closeSidebar} />
      </div>
      <div
        className={`${styles.overlay} ${sidebarOpen ? styles.visible : ""}`}
        onClick={closeSidebar}
      />
      <div className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/drive" replace />} />
          <Route
            path="/drive"
            element={<DriveView type="drive" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/shared"
            element={<DriveView type="shared" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/trash"
            element={<DriveView type="trash" onMenuClick={toggleSidebar} />}
          />
          <Route path="/profile" element={<UserProfile />} />
        </Routes>
      </div>
      {/* Global Preview Modal */}
      <PreviewModal />
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth Routes */}
              <Route
                path="/register"
                element={
                  <AuthRoute>
                    <Register />
                  </AuthRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <AuthRoute>
                    <Login />
                  </AuthRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <AuthRoute>
                    <ForgotPassword />
                  </AuthRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <AuthRoute>
                    <ResetPassword />
                  </AuthRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <UIProvider>
                      <DriveProvider>
                        <SelectionProvider>
                          <AppLayout />
                        </SelectionProvider>
                      </DriveProvider>
                    </UIProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <ToastContainer
              position="top-right"
              toastStyle={{
                zIndex: 9999,
              }}
              className="react-toast-container"
              style={{
                zIndex: 9999,
              }}
            />
          </BrowserRouter>
        </UserSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
