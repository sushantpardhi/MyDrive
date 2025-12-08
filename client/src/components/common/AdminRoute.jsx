import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts";
import logger from "../../utils/logger";

/**
 * AdminRoute component - Protects routes that require admin role
 * Redirects non-admin users to the drive page
 */
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "1.1rem",
          color: "var(--color-text-secondary)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    logger.warn("Unauthenticated user attempted to access admin route");
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    logger.warn("Non-admin user attempted to access admin route", {
      userId: user.id,
      role: user.role,
    });
    return <Navigate to="/drive" replace />;
  }

  return children;
};

export default AdminRoute;
