import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./ProgressiveImage.module.css";

/**
 * ProgressiveImage Component
 * 
 * Implements progressive image loading with independent loading of each quality level.
 * 
 * Features:
 * - Shows blur image immediately when available (instant placeholder)
 * - Replaces with low-quality image when it loads independently
 * - Replaces with original image when it loads independently
 * - Each quality level loads independently via separate API calls
 * - Smooth transitions with fade effects between quality levels
 * - Graceful fallbacks if any quality level is unavailable
 * 
 * @param {Object} props
 * @param {string} props.thumbnailUrl - Always shown in file cards (small, optimized)
 * @param {string} props.blurUrl - Tiny blurred placeholder (shown immediately in preview)
 * @param {string} props.lowQualityUrl - Medium quality image loaded independently
 * @param {string} props.originalUrl - Full quality original image loaded independently
 * @param {string} props.alt - Alt text for accessibility
 * @param {string} props.mode - 'thumbnail' (file card) or 'progressive' (preview modal)
 * @param {Function} props.onLoad - Callback when final image loads
 * @param {string} props.className - Additional CSS classes
 */
const ProgressiveImage = ({
  thumbnailUrl,
  blurUrl,
  lowQualityUrl,
  originalUrl,
  alt = "",
  mode = "thumbnail", // 'thumbnail' or 'progressive'
  onLoad,
  className = "",
  style = {},
}) => {
  // State to track which image is currently displayed
  const [currentSrc, setCurrentSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState(new Set());
  
  // Refs to track component mount state
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // THUMBNAIL MODE: Always show thumbnail only (for file cards)
    if (mode === "thumbnail") {
      if (thumbnailUrl) {
        setCurrentSrc(thumbnailUrl);
        setIsLoading(false);
      }
      return;
    }

    // PROGRESSIVE MODE: Show progressively as each quality level becomes available
    // The URLs are loaded independently by the parent component (PreviewModal)
    // This component simply displays whatever is available at each moment
    if (mode === "progressive") {
      // Priority order: original > low-quality > blur
      // Always show the highest quality available
      
      if (originalUrl) {
        // Original is available - show it

        setCurrentSrc(originalUrl);
        setIsLoading(false);
        
        // Mark as loaded and trigger callback
        if (!loadedImages.has(originalUrl)) {
          setLoadedImages(prev => new Set([...prev, originalUrl]));
          onLoad?.();
        }
      } else if (lowQualityUrl) {
        // Low-quality is available but not original yet - show low-quality

        setCurrentSrc(lowQualityUrl);
        setIsLoading(false);
        
        if (!loadedImages.has(lowQualityUrl)) {
          setLoadedImages(prev => new Set([...prev, lowQualityUrl]));
        }
      } else if (blurUrl) {
        // Only blur is available - show it

        setCurrentSrc(blurUrl);
        setIsLoading(false); // Hide spinner once we have blur
        
        if (!loadedImages.has(blurUrl)) {
          setLoadedImages(prev => new Set([...prev, blurUrl]));
        }
      } else {
        // Nothing available yet - show loading
        setIsLoading(true);
      }
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, [mode, thumbnailUrl, blurUrl, lowQualityUrl, originalUrl, onLoad, loadedImages]);

  // Determine if current image is the blur placeholder
  const isBlurPlaceholder = currentSrc === blurUrl;
  
  // Determine if current image is fully loaded
  const isFullyLoaded = currentSrc === originalUrl && loadedImages.has(originalUrl);

  return (
    <div className={`${styles.progressiveImageContainer} ${className}`} style={style}>
      {currentSrc && (
        <img
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          className={`${styles.progressiveImage} ${
            isBlurPlaceholder ? styles.blur : ""
          } ${isFullyLoaded ? styles.loaded : ""}`}
        />
      )}
      
      {/* Loading indicator: only show if no image is displayed yet in progressive mode */}
      {mode === "progressive" && isLoading && !currentSrc && (
        <div className={styles.loadingIndicator}>
          <div className={styles.spinner}></div>
        </div>
      )}
    </div>
  );
};

ProgressiveImage.propTypes = {
  thumbnailUrl: PropTypes.string,
  blurUrl: PropTypes.string,
  lowQualityUrl: PropTypes.string,
  originalUrl: PropTypes.string,
  alt: PropTypes.string,
  mode: PropTypes.oneOf(["thumbnail", "progressive"]),
  onLoad: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default ProgressiveImage;
