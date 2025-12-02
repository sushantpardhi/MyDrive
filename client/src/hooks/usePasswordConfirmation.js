import { useState, useCallback } from "react";
import api from "../services/api";
import logger from "../utils/logger";

/**
 * Custom hook to manage password confirmation for permanent deletion operations
 * Returns modal state, handlers, and a verify function to be passed to delete operations
 */
export const usePasswordConfirmation = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [resolvePromise, setResolvePromise] = useState(null);
  const [rejectPromise, setRejectPromise] = useState(null);

  const showPasswordModal = useCallback((message) => {
    logger.debug("Showing password confirmation modal", { message });
    setModalMessage(message);
    setIsModalOpen(true);

    // Return a promise that will be resolved/rejected by user action
    return new Promise((resolve, reject) => {
      setResolvePromise(() => resolve);
      setRejectPromise(() => reject);
    });
  }, []);

  const handlePasswordConfirm = useCallback(
    async (password) => {
      try {
        logger.info("Verifying password for permanent deletion");
        // Verify password with backend
        await api.verifyPassword(password);

        logger.info("Password verified successfully");
        // Password is correct, resolve the promise
        if (resolvePromise) {
          resolvePromise();
          setResolvePromise(null);
          setRejectPromise(null);
        }
      } catch (error) {
        // Re-throw error to be handled by the modal component
        throw error;
      }
    },
    [resolvePromise]
  );

  const handleModalClose = useCallback(() => {
    logger.debug("Password confirmation modal closed");
    setIsModalOpen(false);
    setModalMessage("");

    // User cancelled, reject the promise
    if (rejectPromise) {
      rejectPromise(new Error("Password confirmation cancelled"));
      setResolvePromise(null);
      setRejectPromise(null);
    }
  }, [rejectPromise]);

  return {
    isModalOpen,
    modalMessage,
    showPasswordModal,
    handlePasswordConfirm,
    handleModalClose,
  };
};

export default usePasswordConfirmation;
