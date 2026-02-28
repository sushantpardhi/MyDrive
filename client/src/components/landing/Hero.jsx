import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import styles from "./Hero.module.css";
import logger from "../../utils/logger";
import { Moon, Sun } from "lucide-react";

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

// Password strength calculator
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { score: 3, label: "Good", color: "#eab308" };
  if (score <= 4) return { score: 4, label: "Strong", color: "#22c55e" };
  return { score: 5, label: "Very Strong", color: "#10b981" };
};

const FEATURES = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Secure Storage",
    desc: "Your files are protected with encryption and secure authentication",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Lightning Fast",
    desc: "Optimized chunked uploads and instant file previews",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="9"
          y1="14"
          x2="15"
          y2="14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Smart Organization",
    desc: "Tag, sort, and search your files with powerful filters",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <line
          x1="2"
          y1="12"
          x2="22"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
    title: "Access Anywhere",
    desc: "Web-based platform that works seamlessly on any device",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M23 21v-2a4 4 0 00-3-3.87"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 3.13a4 4 0 010 7.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "Guest Access",
    desc: "Try the full experience instantly — no sign-up required",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Dark Mode",
    desc: "Beautiful interface with light and dark theme support",
  },
];

const STATS = [
  { value: "256-bit", label: "Encryption" },
  { value: "50+", label: "File Types" },
  { value: "Instant", label: "Preview" },
];

const Hero = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [existingSession, setExistingSession] = useState(null);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

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

    // Check password mismatch in real-time if in register mode
    if (
      !isLoginMode &&
      (e.target.name === "confirmPassword" || e.target.name === "password")
    ) {
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

    // Validation
    if (isLoginMode) {
      if (!formData.email || !formData.password) {
        setError("Email and password are required");
        return;
      }
    } else {
      if (!formData.name || !formData.email || !formData.password) {
        setError("All fields are required");
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      let response;
      if (isLoginMode) {
        response = await api.login(formData.email, formData.password);
        logger.logAuth(
          "login_success",
          response.data.user.id,
          "User logged in successfully",
        );
      } else {
        response = await api.register(
          formData.name,
          formData.email,
          formData.password,
          { theme },
        );
        logger.logAuth(
          "register_success",
          response.data.user.id,
          "User registered successfully",
        );
      }

      // Store user info via context
      login(response.data.user);

      // Navigate to drive
      navigate("/");
    } catch (err) {
      logger.error(`${isLoginMode ? "Login" : "Registration"} failed`, {
        error: err,
      });

      if (isLoginMode) {
        if (err.response?.data?.errorType === "USER_NOT_FOUND") {
          setError(
            "No account found with this email. Please switch to Register.",
          );
        } else if (err.response?.data?.errorType === "INVALID_CREDENTIALS") {
          setError("Invalid password. Please try again.");
        } else {
          setError(
            err.response?.data?.error || "Login failed. Please try again.",
          );
        }
      } else {
        if (err.response?.data?.errorType === "USER_EXISTS") {
          setError(
            "An account with this email already exists. Please switch to Login.",
          );
        } else {
          setError(
            err.response?.data?.error ||
              "Registration failed. Please try again.",
          );
        }
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

      localStorage.setItem("guestSession", JSON.stringify(session));
      login(user);
      navigate("/");
    } catch (err) {
      logger.error("Resume guest session failed", { error: err });
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
      const previousSessionId = existingSession?.sessionId;
      const response = await api.createGuestSession(previousSessionId);

      const { token, user, session } = response.data;
      localStorage.setItem("guestSession", JSON.stringify(session));
      login(user);
      navigate("/");
    } catch (err) {
      logger.error("Guest login failed", { error: err });
      setError(err.response?.data?.error || "Failed to create guest session");
    } finally {
      setGuestLoading(false);
    }
  }, [login, navigate, existingSession]);

  const getTimeRemaining = () => {
    if (!existingSession?.expiresAt) return "";
    const remaining =
      new Date(existingSession.expiresAt).getTime() - Date.now();
    const minutes = Math.floor(remaining / 60000);
    return `${minutes} min`;
  };

  const toggleMode = (mode) => {
    setIsLoginMode(mode === "login");
    setError("");
    setPasswordMismatch(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className={styles.heroContainer}>
      {/* Floating animated orbs */}
      <div className={styles.floatingOrbs}>
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
      </div>

      {/* Left side: Premium Hero Section */}
      <div className={styles.heroContent}>
        {/* Brand */}
        <div className={styles.heroBrand}>
          <div className={styles.brandLogo}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="rgba(255,255,255,0.15)"
              />
              <path
                d="M12 11v6M9 14h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className={styles.brandName}>MyDrive</span>
        </div>

        <button
          onClick={toggleTheme}
          className={styles.themeToggle}
          aria-label="Toggle theme"
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            padding: "10px",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            zIndex: 100,
          }}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <h1 className={styles.heroTitle}>
          Your Personal Cloud Storage,{" "}
          <span className={styles.titleHighlight}>Reimagined.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          A full-featured cloud drive you can self-host. Upload, organize,
          preview, and manage your files from anywhere with a beautiful, fast,
          and secure interface.
        </p>

        {/* Feature grid */}
        <div className={styles.featureGrid}>
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className={styles.featureCard}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={styles.featureIcon}>{feat.icon}</div>
              <div className={styles.featureText}>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className={styles.statsBar}>
          {STATS.map((stat, i) => (
            <div key={i} className={styles.statItem}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Auth Card */}
      <div className={styles.heroAuthWrapper}>
        <div className={styles.authCard}>
          <div className={styles.authTabs}>
            <button
              className={`${styles.authTab} ${isLoginMode ? styles.active : ""}`}
              onClick={() => toggleMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`${styles.authTab} ${!isLoginMode ? styles.active : ""}`}
              onClick={() => toggleMode("register")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <div className={styles.authHeader}>
            <div className={styles.authEmoji}>{isLoginMode ? "👋" : "🚀"}</div>
            <h2>{isLoginMode ? "Welcome Back" : "Create Account"}</h2>
            <p>
              {isLoginMode
                ? "Enter your credentials to access your files"
                : "Join us to start managing your files"}
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.authForm}>
            {!isLoginMode && (
              <div
                className={`${styles.formGroup} ${styles.formTransitionGroup}`}
              >
                <label htmlFor="name">Full Name</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
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
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 7l-10 7L2 7" />
                  </svg>
                </span>
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
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={
                    isLoginMode ? "Enter your password" : "Create a password"
                  }
                  autoComplete={
                    isLoginMode ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Password strength meter for signup */}
              {!isLoginMode && formData.password && (
                <div className={styles.strengthMeter}>
                  <div className={styles.strengthBar}>
                    <div
                      className={styles.strengthFill}
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: passwordStrength.color,
                      }}
                    />
                  </div>
                  <span
                    className={styles.strengthLabel}
                    style={{ color: passwordStrength.color }}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {!isLoginMode && (
              <div
                className={`${styles.formGroup} ${styles.formTransitionGroup}`}
              >
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={passwordMismatch ? styles.inputError : ""}
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordMismatch && (
                  <span className={styles.fieldError}>
                    Passwords do not match
                  </span>
                )}
              </div>
            )}

            {isLoginMode && (
              <div className={styles.forgotPassword}>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading
                ? isLoginMode
                  ? "Signing In..."
                  : "Creating Account..."
                : isLoginMode
                  ? "Sign In"
                  : "Sign Up"}
            </button>
          </form>

          <div className={styles.authFooter}>
            <div className={styles.guestDivider}>
              <span>
                {existingSession ? "guest access" : "no account? try it first"}
              </span>
            </div>

            {existingSession ? (
              <div className={styles.guestSessionOptions}>
                <button
                  type="button"
                  className={styles.resumeSessionButton}
                  onClick={handleResumeSession}
                  disabled={resumeLoading || guestLoading}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 8 }}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                  </svg>
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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 8 }}
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {guestLoading
                  ? "Starting Guest Session..."
                  : "Continue as Guest"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
