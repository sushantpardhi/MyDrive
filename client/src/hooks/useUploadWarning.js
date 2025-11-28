import { useEffect } from "react";

/**
 * Hook to warn users when trying to leave the page during active uploads
 *
 * Flow:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Upload Active (uploading = true)                           │
 * └─────────────────────────────────────────────────────────────┘
 *                           │
 *          ┌────────────────┴────────────────┐
 *          │                                 │
 *          ▼                                 ▼
 * ┌─────────────────┐              ┌─────────────────┐
 * │ Browser Action  │              │ In-App Action   │
 * │ - Close tab     │              │ - Click sidebar │
 * │ - Refresh       │              │ - Browser back  │
 * │ - Back button   │              │ - Navigation    │
 * │ - URL change    │              │                 │
 * └─────────────────┘              └─────────────────┘
 *          │                                 │
 *          ▼                                 ▼
 * ┌─────────────────┐              ┌─────────────────┐
 * │ beforeunload    │              │  beforeunload   │
 * │ Event Handler   │              │  Event Handler  │
 * └─────────────────┘              └─────────────────┘
 *          │                                 │
 *          ▼                                 ▼
 * ┌─────────────────────────────────────────────────┐
 * │         Browser Native Confirmation             │
 * │    (Covers all navigation types)                │
 * └─────────────────────────────────────────────────┘
 *          │
 *    ┌─────┴─────┐
 *    ▼           ▼
 * [Stay]      [Leave]
 * Continue    Cancel
 * uploads     uploads
 *
 * Note: Uses beforeunload for all navigation types including in-app navigation.
 * Modern browsers show generic warning messages (cannot be customized for security).
 *
 * @param {boolean} uploading - Whether uploads are currently active
 */
export const useUploadWarning = (uploading) => {
  // Handle browser tab close/refresh AND in-app navigation
  useEffect(() => {
    if (!uploading) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Modern browsers require returnValue to be set
      e.returnValue = "";
      // Return a string for older browsers (most modern browsers ignore this and show their own message)
      return "You have uploads in progress. If you leave now, your uploads will be cancelled. Are you sure you want to leave?";
    };

    // Add the event listener
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup function
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading]);
};
