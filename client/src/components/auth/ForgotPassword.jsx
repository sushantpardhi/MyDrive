import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import styles from "./Auth.module.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!email) {
      setError("Email address is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSuccess(true);
      setEmail("");
    } catch (err) {
      // Note: Server returns same message for security (no user enumeration)
      const errorMessage =
        err.response?.data?.error ||
        "An error occurred. Please try again later.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Reset Password</h1>
          <p>Enter your email to receive a password reset link</p>
        </div>

        {success && (
          <div className={styles.successMessage}>
            <strong>Check your email!</strong>
            <p>
              If an account exists with this email, you'll receive password
              reset instructions shortly.
            </p>
            <p style={{ fontSize: "14px", marginTop: "10px", opacity: 0.8 }}>
              Don't see the email? Check your spam folder.
            </p>
          </div>
        )}

        {error && !success && (
          <div className={styles.errorMessage}>{error}</div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter your email"
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className={styles.authFooter}>
          <p>
            <Link to="/login">← Back to Login</Link>
          </p>
          {success && (
            <p style={{ marginTop: "10px" }}>
              Didn't receive the email?{" "}
              <button
                onClick={() => {
                  setSuccess(false);
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  font: "inherit",
                }}
              >
                Try again
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
