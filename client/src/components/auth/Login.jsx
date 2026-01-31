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

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [existingSession, setExistingSession] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check for existing guest session on mount
  useEffect(() => {
    const session = getStoredGuestSession();
    setExistingSession(session);
  }, []);

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

    setLoading(true);

    try {
      const response = await api.login(formData.email, formData.password);

      // Store token and user info via context
      login(response.data.user, response.data.token);

      logger.logAuth(
        "login_success",
        response.data.user.id,
        "User logged in successfully",
      );

      // Navigate to drive
      navigate("/");
    } catch (err) {
      logger.error("Login failed", { error: err });

      // Check for different error types
      if (err.response?.data?.errorType === "USER_NOT_FOUND") {
        setShowRegisterPrompt(true);
        setError("No account found with this email");
      } else if (err.response?.data?.errorType === "INVALID_CREDENTIALS") {
        setError("Invalid password. Please try again.");
      } else {
        setError(
          err.response?.data?.error || "Login failed. Please try again.",
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
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
            {showRegisterPrompt && (
              <span className={styles.registerPrompt}>
                {" "}
                <Link to="/register">Create an account</Link>
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.authForm}>
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
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.forgotPassword}>
            <Link to="/forgot-password">Forgot password?</Link>
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

export default Login;
