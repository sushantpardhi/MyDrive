import React, { useState } from "react";
import { X, Lock, AlertTriangle } from "lucide-react";
import styles from "./PasswordConfirmModal.module.css";
import logger from "../../utils/logger";

const PasswordConfirmModal = ({ isOpen, onClose, onConfirm, message }) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Password is required");
      logger.warn("Password confirmation attempted with empty password");
      return;
    }

    setLoading(true);
    try {
      logger.info("Attempting password verification for permanent deletion");
      await onConfirm(password);
      setPassword("");
      onClose();
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Incorrect password. Please try again.";
      setError(errorMsg);
      logger.error("Password confirmation failed", {
        error: errorMsg,
        statusCode: err.response?.status,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
    logger.debug("Password confirmation modal closed without action");
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <AlertTriangle className={styles.warningIcon} size={24} />
            <h2 className={styles.title}>Confirm Permanent Deletion</h2>
          </div>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
          <p className={styles.warning}>
            This action cannot be undone. Please enter your password to confirm.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input
                type="password"
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.confirmButton}
                disabled={loading || !password.trim()}
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordConfirmModal;
