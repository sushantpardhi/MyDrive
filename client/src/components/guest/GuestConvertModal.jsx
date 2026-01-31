import { useState } from "react";
import { useGuest } from "../../contexts/GuestContext";
import styles from "./GuestConvertModal.module.css";

const GuestConvertModal = () => {
  const { showConvertModal, setShowConvertModal, convertToAccount } =
    useGuest();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  if (!showConvertModal) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");

    // Check password match
    if (name === "confirmPassword" || name === "password") {
      const password = name === "password" ? value : formData.password;
      const confirmPassword =
        name === "confirmPassword" ? value : formData.confirmPassword;
      setPasswordMismatch(confirmPassword && password !== confirmPassword);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setPasswordMismatch(true);
      return;
    }

    setLoading(true);
    const result = await convertToAccount(
      formData.name.trim(),
      formData.email.trim(),
      formData.password,
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }
    // Success case is handled in GuestContext (redirect to home)
  };

  const handleClose = () => {
    setShowConvertModal(false);
    setFormData({ name: "", email: "", password: "", confirmPassword: "" });
    setError("");
    setPasswordMismatch(false);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>

        <div className={styles.header}>
          <div className={styles.icon}>🎉</div>
          <h2>Create Your Account</h2>
          <p>Save your files permanently and unlock all features</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              autoComplete="name"
              required
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
              autoComplete="email"
              required
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
              minLength={6}
              required
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
              required
            />
            {passwordMismatch && (
              <span className={styles.fieldError}>Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || passwordMismatch}
          >
            {loading ? "Creating Account..." : "Create Account & Save Files"}
          </button>
        </form>

        <div className={styles.benefits}>
          <h4>What you'll get:</h4>
          <ul>
            <li>✅ Permanent file storage</li>
            <li>✅ Access to sharing features</li>
            <li>✅ 5GB storage (upgradeable)</li>
            <li>✅ All your current files preserved</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GuestConvertModal;
