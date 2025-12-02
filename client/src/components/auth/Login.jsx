import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useUIContext } from "../../contexts";
import styles from "./Auth.module.css";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showLoading, hideLoading } = useUIContext();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
    setShowRegisterPrompt(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowRegisterPrompt(false);

    // Validation
    if (!formData.email || !formData.password) {
      setError("Email and password are required");
      return;
    }

    showLoading("Signing in...");

    try {
      const response = await api.login(formData.email, formData.password);

      // Store token and user info via context
      login(response.data.user, response.data.token);

      // Redirect to drive
      navigate("/drive");
    } catch (err) {
      const errorType = err.response?.data?.errorType;
      const errorMessage = err.response?.data?.error;

      if (errorType === "USER_NOT_FOUND") {
        setError("No account found with this email address.");
        setShowRegisterPrompt(true);
      } else if (errorType === "INVALID_PASSWORD") {
        setError(
          "Incorrect password. Please check your password and try again."
        );
      } else if (err.response?.data?.errors?.[0]?.msg) {
        setError(err.response.data.errors[0].msg);
      } else {
        setError(
          errorMessage || "Login failed. Please check your credentials."
        );
      }
    } finally {
      hideLoading();
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Welcome Back</h1>
          <p>Sign in to access your files</p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
            {showRegisterPrompt && (
              <div style={{ marginTop: "10px" }}>
                <Link to="/register" className={styles.registerLink}>
                  Create an account instead →
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              disabled={loading}
            />
            <div
              style={{
                marginTop: "8px",
                textAlign: "right",
                fontSize: "14px",
              }}
            >
              <Link
                to="/forgot-password"
                style={{
                  color: "var(--accent-primary)",
                  textDecoration: "none",
                }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>
            Don't have an account? <Link to="/register">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
