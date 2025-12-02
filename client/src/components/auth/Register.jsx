import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useUIContext } from "../../contexts";
import styles from "./Auth.module.css";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showLoading, hideLoading } = useUIContext();

  const handleChange = (e) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value,
    };

    setFormData(newFormData);
    setError("");
    setShowLoginPrompt(false);

    // Check password mismatch in real-time
    if (e.target.name === "confirmPassword" || e.target.name === "password") {
      const password =
        e.target.name === "password" ? e.target.value : newFormData.password;
      const confirmPassword =
        e.target.name === "confirmPassword"
          ? e.target.value
          : newFormData.confirmPassword;

      if (confirmPassword && password !== confirmPassword) {
        setPasswordMismatch(true);
      } else {
        setPasswordMismatch(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowLoginPrompt(false);

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password.length < 6) {
      setError(
        "Password must be at least 6 characters long. Please choose a stronger password."
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(
        "Passwords do not match. Please make sure both password fields are identical."
      );
      return;
    }

    showLoading("Creating your account...");

    try {
      const response = await api.register(
        formData.name,
        formData.email,
        formData.password
      );

      // Store token and user info via context
      login(response.data.user, response.data.token);

      // Redirect to drive
      navigate("/drive");
    } catch (err) {
      const errorType = err.response?.data?.errorType;
      const errorMessage = err.response?.data?.error;

      if (errorType === "USER_EXISTS") {
        setError("An account with this email address already exists.");
        setShowLoginPrompt(true);
      } else if (err.response?.data?.errors?.[0]?.msg) {
        setError(err.response.data.errors[0].msg);
      } else {
        setError(errorMessage || "Registration failed. Please try again.");
      }
    } finally {
      hideLoading();
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Create Account</h1>
          <p>Sign up to start using MyDrive</p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
            {showLoginPrompt && (
              <div style={{ marginTop: "10px" }}>
                <Link to="/login" className={styles.registerLink}>
                  Sign in to your account →
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              disabled={loading}
            />
          </div>

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
              placeholder="Create a password (min. 6 characters)"
              disabled={loading}
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
              placeholder="Confirm your password"
              disabled={loading}
              style={{
                borderColor: passwordMismatch ? "#fcc" : undefined,
              }}
            />
            {passwordMismatch && (
              <small
                style={{ color: "#c33", fontSize: "12px", marginTop: "4px" }}
              >
                Passwords do not match
              </small>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
