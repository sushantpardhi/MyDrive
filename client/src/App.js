import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
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
import TransferProgressToast from "./components/files/TransferProgressToast.jsx";
import AdminRoute from "./components/common/AdminRoute.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import UserManagement from "./components/admin/UserManagement.jsx";
import FileManagement from "./components/admin/FileManagement.jsx";
import StorageReport from "./components/admin/StorageReport.jsx";
import ActivityLog from "./components/admin/ActivityLog.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DriveProvider } from "./contexts/DriveContext";
import { SelectionProvider } from "./contexts/SelectionContext";
import { UIProvider, useUIContext } from "./contexts/UIContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { TransferProvider, useTransfer } from "./contexts/TransferContext";
import { AdminProvider } from "./contexts/AdminContext";
import { GuestProvider } from "./contexts/GuestContext";
import DevelopmentBanner from "./components/common/DevelopmentBanner.jsx";
import GuestBanner from "./components/guest/GuestBanner.jsx";
import GuestConvertModal from "./components/guest/GuestConvertModal.jsx";
import styles from "./App.module.css";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Wait for auth state to be loaded before making redirect decision
  if (loading) {
    return null; // Or a loading spinner
  }

  return isAuthenticated() ? children : <Navigate to="/login" replace />;
};

// Auth Route Component (redirects to drive if already logged in)
const AuthRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Wait for auth state to be loaded before making redirect decision
  if (loading) {
    return null; // Or a loading spinner
  }

  return isAuthenticated() ? <Navigate to="/drive" replace /> : children;
};

// Main App Layout with contexts
const AppLayout = () => {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIContext();
  const {
    uploadProgress,
    downloadProgress,
    cancelUpload,
    cancelDownload,
    removeDownload,
    cancelAll,
    resetProgress,
  } = useTransfer();
  const location = useLocation();

  // Check if transfer modal should be hidden based on current route
  const hideTransferModal =
    location.pathname === "/admin" ||
    location.pathname === "/admin/users" ||
    location.pathname === "/admin/files" ||
    location.pathname === "/admin/storage" ||
    location.pathname === "/admin/activity" ||
    location.pathname === "/profile";

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
            path="/drive/:folderId"
            element={<DriveView type="drive" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/shared"
            element={<DriveView type="shared" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/shared/:folderId"
            element={<DriveView type="shared" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/trash"
            element={<DriveView type="trash" onMenuClick={toggleSidebar} />}
          />
          <Route
            path="/trash/:folderId"
            element={<DriveView type="trash" onMenuClick={toggleSidebar} />}
          />
          <Route path="/profile" element={<UserProfile />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/files"
            element={
              <AdminRoute>
                <FileManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/storage"
            element={
              <AdminRoute>
                <StorageReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/activity"
            element={
              <AdminRoute>
                <ActivityLog />
              </AdminRoute>
            }
          />
        </Routes>
      </div>
      {/* Global Preview Modal */}
      <PreviewModal />
      {/* Global Transfer Progress Toast - Hidden on admin dashboard and profile pages */}
      {!hideTransferModal && (
        <TransferProgressToast
          isOpen={true}
          uploadProgress={uploadProgress}
          downloadProgress={downloadProgress}
          onClose={resetProgress}
          onStopUpload={cancelUpload}
          onCancelDownload={cancelDownload}
          onRemoveDownload={removeDownload}
          onStopAll={cancelAll}
        />
      )}
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <BrowserRouter>
            {/* <DevelopmentBanner /> */}
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
                      <TransferProvider>
                        <DriveProvider>
                          <SelectionProvider>
                            <AdminProvider>
                              <GuestProvider>
                                <GuestBanner />
                                <GuestConvertModal />
                                <AppLayout />
                              </GuestProvider>
                            </AdminProvider>
                          </SelectionProvider>
                        </DriveProvider>
                      </TransferProvider>
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
