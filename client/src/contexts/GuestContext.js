import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";
import logger from "../utils/logger";

const GuestContext = createContext(null);

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error("useGuest must be used within a GuestProvider");
  }
  return context;
};

export const GuestProvider = ({ children }) => {
  const { user, logout } = useAuth();
  const [sessionData, setSessionData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const countdownRef = useRef(null);
  const statusCheckRef = useRef(null);

  const isTemporaryGuest = user?.isTemporaryGuest === true;

  // Handle session expiration - defined first as other callbacks depend on it
  const handleSessionExpired = useCallback(() => {
    logger.info("Guest session expired, logging out");
    localStorage.removeItem("guestSession");
    logout();
  }, [logout]);

  // Fetch session status from API
  const fetchSessionStatus = useCallback(async () => {
    if (!isTemporaryGuest) return;

    try {
      const response = await api.getGuestStatus();
      const data = response.data;

      setSessionData(data);
      setTimeRemaining(data.remainingMs);

      // Show warning when less than 5 minutes remaining
      if (data.remainingMs <= 5 * 60 * 1000 && data.remainingMs > 0) {
        setShowExpiryWarning(true);
      }

      // Session explicitly marked as invalid by server
      if (data.isValid === false) {
        handleSessionExpired();
      }
    } catch (error) {
      logger.error("Failed to fetch guest session status", { error });

      // Only logout on explicit session expiry/not found errors
      // Don't logout on 401 (token might just need refresh) or network errors
      const errorCode = error.response?.data?.code;
      if (
        errorCode === "GUEST_SESSION_EXPIRED" ||
        errorCode === "GUEST_SESSION_NOT_FOUND"
      ) {
        handleSessionExpired();
      }
      // For other errors (401, network, etc.), just log and continue
    }
  }, [isTemporaryGuest, handleSessionExpired]);

  // Extend session
  const extendSession = useCallback(async () => {
    if (!isTemporaryGuest) return { success: false };

    try {
      const response = await api.extendGuestSession();
      const data = response.data;

      setSessionData(data);
      setTimeRemaining(data.remainingMs);
      setShowExpiryWarning(false);

      // Update localStorage
      const storedSession = JSON.parse(
        localStorage.getItem("guestSession") || "{}",
      );
      localStorage.setItem(
        "guestSession",
        JSON.stringify({
          ...storedSession,
          expiresAt: data.expiresAt,
          extensionCount: data.extensionCount,
        }),
      );

      return { success: true, data };
    } catch (error) {
      logger.error("Failed to extend guest session", { error });
      return {
        success: false,
        error: error.response?.data?.error || "Failed to extend session",
      };
    }
  }, [isTemporaryGuest]);

  // Convert guest to full account
  const convertToAccount = useCallback(
    async (name, email, password) => {
      if (!isTemporaryGuest) return { success: false };

      try {
        const response = await api.convertGuestToUser(name, email, password);
        const { token, user: newUser } = response.data;

        // Clear guest session data
        localStorage.removeItem("guestSession");
        setSessionData(null);
        setTimeRemaining(null);
        setShowConvertModal(false);

        // Update auth with new user data
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(newUser));

        // Force page reload to reset all contexts
        window.location.href = "/";

        return { success: true, data: response.data };
      } catch (error) {
        logger.error("Failed to convert guest account", { error });
        return {
          success: false,
          error: error.response?.data?.error || "Failed to create account",
        };
      }
    },
    [isTemporaryGuest],
  );

  // Countdown timer effect
  useEffect(() => {
    if (!isTemporaryGuest || !timeRemaining) return;

    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1000) {
          handleSessionExpired();
          return 0;
        }

        // Show warning when less than 5 minutes
        if (prev <= 5 * 60 * 1000 + 1000 && prev > 5 * 60 * 1000) {
          setShowExpiryWarning(true);
        }

        return prev - 1000;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isTemporaryGuest, timeRemaining, handleSessionExpired]);

  // Periodic status check (every 30 seconds)
  // Delay initial check to allow auth to settle after login
  useEffect(() => {
    if (!isTemporaryGuest) return;

    // Delay initial fetch by 2 seconds to let auth token settle
    const initialTimeout = setTimeout(() => {
      fetchSessionStatus();
    }, 2000);

    // Set up periodic check
    statusCheckRef.current = setInterval(fetchSessionStatus, 30000);

    return () => {
      clearTimeout(initialTimeout);
      if (statusCheckRef.current) {
        clearInterval(statusCheckRef.current);
      }
    };
  }, [isTemporaryGuest, fetchSessionStatus]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (isTemporaryGuest) {
      const storedSession = localStorage.getItem("guestSession");
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          const expiresAt = new Date(parsed.expiresAt).getTime();
          const remaining = expiresAt - Date.now();

          if (remaining > 0) {
            setTimeRemaining(remaining);
            setSessionData({
              ...parsed,
              remainingMs: remaining,
              isValid: true,
            });
          } else {
            handleSessionExpired();
          }
        } catch (e) {
          logger.error("Failed to parse stored guest session", { error: e });
        }
      } else {
        // No stored session, fetch from API
        fetchSessionStatus();
      }
    }
  }, [isTemporaryGuest, fetchSessionStatus, handleSessionExpired]);

  // Format time remaining for display
  const formatTimeRemaining = useCallback(() => {
    if (!timeRemaining) return "0:00";

    const totalSeconds = Math.floor(timeRemaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeRemaining]);

  const value = {
    isTemporaryGuest,
    sessionData,
    timeRemaining,
    formattedTime: formatTimeRemaining(),
    canExtend: sessionData?.canExtend ?? false,
    extensionsLeft: sessionData
      ? sessionData.maxExtensions - sessionData.extensionCount
      : 0,
    showConvertModal,
    setShowConvertModal,
    showExpiryWarning,
    setShowExpiryWarning,
    extendSession,
    convertToAccount,
  };

  return (
    <GuestContext.Provider value={value}>{children}</GuestContext.Provider>
  );
};

export default GuestContext;
