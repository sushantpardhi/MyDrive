import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./ProgressiveImage.module.css";

/**
 * ProgressiveImage Component
 * 
 * Implements progressive image loading similar to BlurHash/LQIP pattern.
 * 
 * Features:
 * - Shows blur image immediately for fast perceived load
 * - Detects network speed to optimize loading strategy
 * - On fast networks (4g): loads original directly, skips low-quality
 * - On slow networks: loads low-quality first, then original
 * - Smooth transitions with fade effects
 * - Gracefully handles browsers without Network Information API
 * 
 * @param {Object} props
 * @param {string} props.thumbnailUrl - Always shown in file cards (small, optimized)
 * @param {string} props.blurUrl - Tiny blurred placeholder (shown immediately in preview)
 * @param {string} props.lowQualityUrl - Medium quality image for slow networks
 * @param {string} props.originalUrl - Full quality original image
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
  
  // Refs to track component mount state and image elements
  const isMountedRef = useRef(true);
  const imageRefs = useRef({});

  /**
   * Detect effective network speed
   * Returns 'fast' for 4g/good connections, 'slow' otherwise
   */
  const getNetworkSpeed = () => {
    // Check if Network Information API is available
    if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
      // Fallback: assume moderate speed if API unavailable
      return "moderate";
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink; // Mbps

    // Consider it fast if:
    // - effectiveType is '4g', OR
    // - downlink >= 5 Mbps (configurable threshold)
    if (effectiveType === "4g" || downlink >= 5) {
      return "fast";
    }

    return "slow";
  };

  /**
   * Preload an image and return a promise
   */
  const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("No URL provided"));
        return;
      }

      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
      
      // Store reference for cleanup
      imageRefs.current[url] = img;
    });
  };

  /**
   * Mark an image as loaded
   */
  const markImageLoaded = (url) => {
    if (isMountedRef.current) {
      setLoadedImages(prev => new Set([...prev, url]));
    }
  };

  /**
   * Update current displayed source with smooth transition
   */
  const updateCurrentSrc = (url) => {
    if (isMountedRef.current && url) {
      setCurrentSrc(url);
      markImageLoaded(url);
    }
  };

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

    // PROGRESSIVE MODE: Smart loading based on network speed
    if (mode === "progressive") {
      const loadProgressively = async () => {
        try {
          // Step 1: Show blur image immediately (smallest, loads instantly)
          if (blurUrl) {
            updateCurrentSrc(blurUrl);
          }

          // Step 2: Detect network speed
          const networkSpeed = getNetworkSpeed();

          // Step 3: Load based on network conditions
          if (networkSpeed === "fast") {
            // FAST NETWORK: Load original directly, skip low-quality
            console.log("[ProgressiveImage] Fast network detected, loading original directly");
            
            try {
              await preloadImage(originalUrl);
              updateCurrentSrc(originalUrl);
              setIsLoading(false);
              onLoad?.();
            } catch (error) {
              console.error("[ProgressiveImage] Failed to load original:", error);
              // Fallback to low-quality if original fails
              if (lowQualityUrl) {
                await preloadImage(lowQualityUrl);
                updateCurrentSrc(lowQualityUrl);
              }
              setIsLoading(false);
            }
          } else {
            // SLOW NETWORK: Load low-quality first, then original
            console.log("[ProgressiveImage] Slow network detected, loading progressively");
            
            // Load low-quality first
            if (lowQualityUrl) {
              try {
                await preloadImage(lowQualityUrl);
                updateCurrentSrc(lowQualityUrl);
              } catch (error) {
                console.error("[ProgressiveImage] Failed to load low-quality:", error);
              }
            }

            // Then load original in background
            if (originalUrl) {
              try {
                await preloadImage(originalUrl);
                updateCurrentSrc(originalUrl);
                setIsLoading(false);
                onLoad?.();
              } catch (error) {
                console.error("[ProgressiveImage] Failed to load original:", error);
                setIsLoading(false);
              }
            }
          }
        } catch (error) {
          console.error("[ProgressiveImage] Progressive loading error:", error);
          setIsLoading(false);
        }
      };

      loadProgressively();
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      // Clean up image references
      Object.values(imageRefs.current).forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
      imageRefs.current = {};
    };
  }, [mode, thumbnailUrl, blurUrl, lowQualityUrl, originalUrl, onLoad]);

  // Determine if current image is the blur placeholder
  const isBlurPlaceholder = currentSrc === blurUrl;
  
  // Determine if current image is fully loaded
  const isFullyLoaded = currentSrc === originalUrl && loadedImages.has(originalUrl);

  return (
    <div className={`${styles.progressiveImageContainer} ${className}`} style={style}>
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`${styles.progressiveImage} ${
            isBlurPlaceholder ? styles.blur : ""
          } ${isFullyLoaded ? styles.loaded : ""}`}
          loading="lazy"
        />
      )}
      
      {/* Loading indicator for progressive mode */}
      {mode === "progressive" && isLoading && (
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
