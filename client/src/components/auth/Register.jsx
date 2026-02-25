import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Auth.module.css";
import logger from "../../utils/logger";

// Helper to check if stored guest session is valid
const getStoredGuestSession = () => {
  try {
    const stored = localStorage.getItem("guestSession");
    if (!stored) return null;

    const session = JSON.parse(stored);
    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();

    // Check if session is expired
    if (now >= expiresAt) {
      localStorage.removeItem("guestSession");
      return null;
    }

    return session;
  } catch (e) {
    localStorage.removeItem("guestSession");
    return null;
  }
};

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [existingSession, setExistingSession] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check for existing guest session on mount
  useEffect(() => {
    const session = getStoredGuestSession();
    setExistingSession(session);
  }, []);

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
        "Password must be at least 6 characters long. Please choose a stronger password.",
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(
        "Passwords do not match. Please make sure both password fields are identical.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await api.register(
        formData.name,
        formData.email,
        formData.password,
      );

      // Store token and user info via context
      login(response.data.user, response.data.token);

      logger.logAuth(
        "register_success",
        response.data.user.id,
        "User registered successfully",
      );

      // Navigate to drive
      navigate("/");
    } catch (err) {
      logger.error("Registration failed", { error: err });

      // Check for user exists error
      if (err.response?.data?.errorType === "USER_EXISTS") {
        setShowLoginPrompt(true);
        setError("An account with this email already exists");
      } else {
        setError(
          err.response?.data?.error || "Registration failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Resume existing guest session
  const handleResumeSession = useCallback(async () => {
    if (!existingSession?.sessionId) return;

    setResumeLoading(true);
    setError("");

    try {
      const response = await api.resumeGuestSession(existingSession.sessionId);
      const { token, user, session } = response.data;

      // Update localStorage with fresh session data
      localStorage.setItem("guestSession", JSON.stringify(session));
      login(user, token);
      navigate("/");
    } catch (err) {
      logger.error("Resume guest session failed", { error: err });

      // If session is expired or not found, clear it
      if (
        err.response?.data?.code === "GUEST_SESSION_EXPIRED" ||
        err.response?.data?.code === "GUEST_SESSION_NOT_FOUND" ||
        err.response?.data?.code === "GUEST_USER_NOT_FOUND"
      ) {
        localStorage.removeItem("guestSession");
        setExistingSession(null);
        setError("Your previous guest session has expired");
      } else {
        setError(err.response?.data?.error || "Failed to resume session");
      }
    } finally {
      setResumeLoading(false);
    }
  }, [existingSession, login, navigate]);

  // Create new guest session
  const handleNewGuestSession = useCallback(async () => {
    setGuestLoading(true);
    setError("");

    try {
      // Pass existing session ID if available to trigger cleanup
      const previousSessionId = existingSession?.sessionId;
      const response = await api.createGuestSession(previousSessionId);

      const { token, user, session } = response.data;
      localStorage.setItem("guestSession", JSON.stringify(session));
      login(user, token);
      navigate("/");
    } catch (err) {
      logger.error("Guest login failed", { error: err });
      setError(err.response?.data?.error || "Failed to create guest session");
    } finally {
      setGuestLoading(false);
    }
  }, [login, navigate, existingSession]);

  // Calculate remaining time for display
  const getTimeRemaining = () => {
    if (!existingSession?.expiresAt) return "";
    const remaining =
      new Date(existingSession.expiresAt).getTime() - Date.now();
    const minutes = Math.floor(remaining / 60000);
    return `${minutes} min`;
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h1>Create Account</h1>
          <p>Sign up to get started</p>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
            {showLoginPrompt && (
              <span className={styles.loginPrompt}>
                {" "}
                <Link to="/login">Sign in instead</Link>
              </span>
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
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="email"
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
              placeholder="Create a password"
              autoComplete="new-password"
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
              autoComplete="new-password"
              className={passwordMismatch ? styles.inputError : ""}
            />
            {passwordMismatch && (
              <span className={styles.fieldError}>Passwords do not match</span>
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
          <div className={styles.guestDivider}>
            <span>or</span>
          </div>

          {existingSession ? (
            <div className={styles.guestSessionOptions}>
              <button
                type="button"
                className={styles.resumeSessionButton}
                onClick={handleResumeSession}
                disabled={resumeLoading || guestLoading}
              >
                {resumeLoading
                  ? "Resuming..."
                  : `Continue Previous Session (${getTimeRemaining()} left)`}
              </button>
              <button
                type="button"
                className={styles.newSessionButton}
                onClick={handleNewGuestSession}
                disabled={guestLoading || resumeLoading}
              >
                {guestLoading ? "Starting..." : "Start New Guest Session"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.guestLink}
              onClick={handleNewGuestSession}
              disabled={guestLoading}
            >
              {guestLoading ? "Starting Guest Session..." : "Continue as Guest"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
