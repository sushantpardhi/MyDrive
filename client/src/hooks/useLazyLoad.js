import { useEffect, useRef, useState } from "react";
import logger from "../utils/logger";

/**
 * Custom hook for lazy loading elements using Intersection Observer API
 * Only loads content when the element becomes visible in the viewport
 *
 * @param {Object} options - Intersection Observer options
 * @param {string} options.rootMargin - Margin around root (default: "50px")
 * @param {number} options.threshold - Visibility threshold (default: 0.01)
 * @returns {Object} - { ref, isVisible } - Attach ref to element, isVisible indicates visibility
 */
const useLazyLoad = ({ rootMargin = "50px", threshold = 0.01 } = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // If already been visible, don't need to observe again
    if (hasBeenVisible) return;

    // Check if browser supports Intersection Observer
    if (!("IntersectionObserver" in window)) {
      logger.warn(
        "IntersectionObserver not supported, loading content immediately"
      );
      setIsVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasBeenVisible(true);
            logger.debug("Element became visible", {
              intersectionRatio: entry.intersectionRatio,
            });
            // Once visible, stop observing
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    // Cleanup function
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [rootMargin, threshold, hasBeenVisible]);

  return {
    ref: elementRef,
    isVisible: hasBeenVisible, // Use hasBeenVisible to ensure content stays loaded
  };
};

export default useLazyLoad;
