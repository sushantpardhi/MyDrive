import { useState, useEffect } from "react";
import api from "../services/api";

/**
 * Custom hook for managing progressive image loading
 * 
 * Automatically loads all image variants (blur, low-quality, original)
 * for a given file, handling cleanup and error cases.
 * 
 * @param {string} fileId - The file ID to load images for
 * @param {boolean} enabled - Whether to start loading (default: true)
 * @returns {Object} Object with urls and loading state
 * 
 * @example
 * const { blurUrl, lowQualityUrl, originalUrl, loading, error } = useProgressiveImage(fileId);
 * 
 * return (
 *   <ProgressiveImage
 *     blurUrl={blurUrl}
 *     lowQualityUrl={lowQualityUrl}
 *     originalUrl={originalUrl}
 *     mode="progressive"
 *   />
 * );
 */
export const useProgressiveImage = (fileId, enabled = true) => {
  const [blurUrl, setBlurUrl] = useState(null);
  const [lowQualityUrl, setLowQualityUrl] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadImages = async () => {
      if (!enabled || !fileId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Load all three variants in parallel for efficiency
        const results = await Promise.allSettled([
          api.getFileBlur(fileId),
          api.getFileLowQuality(fileId),
          api.getFilePreview(fileId),
        ]);

        if (!mounted) return;

        // Handle blur image
        if (results[0].status === "fulfilled") {
          const url = URL.createObjectURL(results[0].value.data);
          setBlurUrl(url);
        } else {
          console.warn("Failed to load blur image:", results[0].reason);
        }

        // Handle low-quality image
        if (results[1].status === "fulfilled") {
          const url = URL.createObjectURL(results[1].value.data);
          setLowQualityUrl(url);
        } else {
          console.warn("Failed to load low-quality image:", results[1].reason);
        }

        // Handle original image
        if (results[2].status === "fulfilled") {
          const url = URL.createObjectURL(results[2].value.data);
          setOriginalUrl(url);
        } else {
          console.error("Failed to load original image:", results[2].reason);
          setError("Failed to load image");
        }

        setLoading(false);
      } catch (err) {
        if (mounted) {
          console.error("Unexpected error loading image variants:", err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadImages();

    // Cleanup function
    return () => {
      mounted = false;
      // Revoke object URLs to free up memory
      [blurUrl, lowQualityUrl, originalUrl].forEach(url => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [fileId, enabled]);

  return {
    blurUrl,
    lowQualityUrl,
    originalUrl,
    loading,
    error,
  };
};

/**
 * Custom hook for thumbnail loading (file card variant)
 * 
 * Loads only the thumbnail image for file card display
 * 
 * @param {string} fileId - The file ID to load thumbnail for
 * @param {boolean} enabled - Whether to start loading (default: true)
 * @returns {Object} Object with thumbnail url and loading state
 * 
 * @example
 * const { thumbnailUrl, loading } = useThumbnail(fileId);
 * 
 * return (
 *   <ProgressiveImage
 *     thumbnailUrl={thumbnailUrl}
 *     mode="thumbnail"
 *   />
 * );
 */
export const useThumbnail = (fileId, enabled = true) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      if (!enabled || !fileId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await api.getFileThumbnail(fileId);
        
        if (mounted) {
          const url = URL.createObjectURL(response.data);
          setThumbnailUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to load thumbnail:", err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadThumbnail();

    // Cleanup
    return () => {
      mounted = false;
      if (thumbnailUrl && thumbnailUrl.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [fileId, enabled]);

  return {
    thumbnailUrl,
    loading,
    error,
  };
};

export default useProgressiveImage;
