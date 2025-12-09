/**
 * Client-side Logger Utility
 *
 * Provides structured logging for the MyDrive client application.
 * Supports different log levels and can be configured for development/production.
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Color codes for console output
const COLORS = {
  ERROR: "color: #ff4444; font-weight: bold",
  WARN: "color: #ffaa00; font-weight: bold",
  INFO: "color: #00aaff; font-weight: bold",
  DEBUG: "color: #aaaaaa",
  RESET: "color: inherit",
};

class Logger {
  constructor() {
    // Disable all console logs in both development and production
    // Only store errors in memory for debugging
    const isDevelopment = process.env.NODE_ENV === "development";
    this.logLevel = -1; // -1 disables all console logs
    this.isDevelopment = isDevelopment;
  }

  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * Format log message with context
   */
  formatMessage(level, message, context = {}) {
    const timestamp = this.getTimestamp();
    const contextStr =
      Object.keys(context).length > 0
        ? ` | Context: ${JSON.stringify(context)}`
        : "";
    return `[${timestamp}] [${level}]${contextStr} ${message}`;
  }

  /**
   * Core logging method
   */
  log(level, levelValue, message, context = {}, ...args) {
    // Logging completely disabled on frontend
    // Only store critical errors in memory
    if (level === "ERROR") {
      this.storeError({
        level,
        message,
        context,
        args,
        timestamp: this.getTimestamp(),
      });
    }
  }

  /**
   * Store errors for debugging (in-memory for now)
   */
  storeError(errorData) {
    if (typeof window !== "undefined") {
      if (!window.__appErrors) {
        window.__appErrors = [];
      }
      window.__appErrors.push(errorData);

      // Keep only last 50 errors
      if (window.__appErrors.length > 50) {
        window.__appErrors.shift();
      }
    }
  }

  /**
   * Get stored errors
   */
  getStoredErrors() {
    return typeof window !== "undefined" ? window.__appErrors || [] : [];
  }

  /**
   * Clear stored errors
   */
  clearStoredErrors() {
    if (typeof window !== "undefined") {
      window.__appErrors = [];
    }
  }

  /**
   * Log error messages
   */
  error(message, context = {}, ...args) {
    this.log("ERROR", LOG_LEVELS.ERROR, message, context, ...args);
  }

  /**
   * Log warning messages
   */
  warn(message, context = {}, ...args) {
    this.log("WARN", LOG_LEVELS.WARN, message, context, ...args);
  }

  /**
   * Log info messages
   */
  info(message, context = {}, ...args) {
    this.log("INFO", LOG_LEVELS.INFO, message, context, ...args);
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message, context = {}, ...args) {
    this.log("DEBUG", LOG_LEVELS.DEBUG, message, context, ...args);
  }

  /**
   * Log errors with stack trace
   */
  logError(error, message = "", context = {}) {
    const errorContext = {
      ...context,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
    };
    this.error(message || "An error occurred", errorContext);
  }

  /**
   * Log authentication events
   */
  logAuth(action, userId, details = "") {
    this.info(`Auth: ${action}`, {
      userId,
      details,
      action,
    });
  }

  /**
   * Log file operations
   */
  logFileOperation(operation, fileName, context = {}) {
    this.info(`File operation: ${operation}`, {
      fileName,
      operation,
      ...context,
    });
  }

  /**
   * Log upload events
   */
  logUpload(status, fileName, context = {}) {
    this.info(`Upload ${status}: ${fileName}`, {
      status,
      fileName,
      ...context,
    });
  }

  /**
   * Log API requests
   */
  logApiRequest(method, endpoint, context = {}) {
    this.debug(`API Request: ${method} ${endpoint}`, context);
  }
  /**
   * Log API responses
   */
  logApiResponse(method, endpoint, status, context = {}) {
    const level = status >= 400 ? "WARN" : "DEBUG";
    const levelValue = status >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
    this.log(
      level,
      levelValue,
      `API Response: ${method} ${endpoint} - ${status}`,
      context
    );
  }
  /**
   * Log state changes
   */
  logStateChange(component, stateName, oldValue, newValue) {
    this.debug(`State change in ${component}`, {
      component,
      stateName,
      oldValue,
      newValue,
    });
  }

  /**
   * Log component lifecycle events
   */
  logLifecycle(component, event, details = {}) {
    this.debug(`${component} - ${event}`, details);
  }

  /**
   * Log navigation events
   */
  logNavigation(from, to, context = {}) {
    this.info(`Navigation: ${from} → ${to}`, context);
  }

  /**
   * Log user interactions
   */
  logUserAction(action, target, context = {}) {
    this.info(`User action: ${action} on ${target}`, {
      action,
      target,
      ...context,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric, value, context = {}) {
    this.info(`Performance: ${metric} = ${value}ms`, {
      metric,
      value,
      ...context,
    });
  }

  /**
   * Create a child logger with a specific context
   */
  child(defaultContext) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = defaultContext;

    // Override log methods to include default context
    ["error", "warn", "info", "debug"].forEach((method) => {
      const originalMethod = this[method].bind(this);
      childLogger[method] = (message, context = {}, ...args) => {
        originalMethod(message, { ...defaultContext, ...context }, ...args);
      };
    });

    return childLogger;
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;

// Export convenience methods
export const {
  error,
  warn,
  info,
  debug,
  logError,
  logAuth,
  logFileOperation,
  logUpload,
  logApiRequest,
  logApiResponse,
  logStateChange,
  logLifecycle,
  logNavigation,
  logUserAction,
  logPerformance,
} = logger;
