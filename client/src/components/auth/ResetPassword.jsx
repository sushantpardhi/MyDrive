import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../../services/api";
import styles from "./Auth.module.css";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Get token from URL
    const urlToken = searchParams.get("token");
    if (!urlToken) {
      setError(
        "Invalid or missing reset token. Please request a new reset link."
      );
    } else {
      setToken(urlToken);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.password || !formData.confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset token. Please request a new reset link.");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token, formData.password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        "Failed to reset password. The link may have expired.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Set New Password</h1>
          <p>Enter your new password below</p>
        </div>

        {success && (
          <div className={styles.successMessage}>
            <strong>Password Reset Successful!</strong>
            <p>
              Your password has been successfully reset. You can now login with
              your new password.
            </p>
            <p style={{ fontSize: "14px", marginTop: "10px", opacity: 0.8 }}>
              Redirecting to login page...
            </p>
          </div>
        )}

        {error && !success && (
          <div className={styles.errorMessage}>
            {error}
            {(error.includes("expired") || error.includes("Invalid")) && (
              <div style={{ marginTop: "10px" }}>
                <Link to="/forgot-password" className={styles.registerLink}>
                  Request a new reset link →
                </Link>
              </div>
            )}
          </div>
        )}

        {!success && token && (
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.formGroup}>
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter new password (min 6 characters)"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                marginBottom: "20px",
                padding: "12px",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
              }}
            >
              <strong>Password Requirements:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                <li style={{ marginBottom: "4px" }}>
                  At least 6 characters long
                </li>
                <li style={{ marginBottom: "4px" }}>Must match confirmation</li>
              </ul>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className={styles.authFooter}>
          <p>
            <Link to="/login">← Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
