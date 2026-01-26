import { useState, useEffect } from "react";
import api from "../services/api";
import { getCachedImage, setCachedImage } from "../utils/imageCache";

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
        // Check cache first for all three variants
        const [cachedBlur, cachedLowQuality, cachedOriginal] = await Promise.all([
          getCachedImage(fileId, 'blur'),
          getCachedImage(fileId, 'low-quality'),
          getCachedImage(fileId, 'original'),
        ]);

        if (!mounted) return;

        // Load blur from cache or fetch
        if (cachedBlur) {
          const url = URL.createObjectURL(cachedBlur);
          setBlurUrl(url);
        }

        // Load low-quality from cache or fetch
        if (cachedLowQuality) {
          const url = URL.createObjectURL(cachedLowQuality);
          setLowQualityUrl(url);
        }

        // Load original from cache or fetch
        if (cachedOriginal) {
          const url = URL.createObjectURL(cachedOriginal);
          setOriginalUrl(url);
        }

        // Determine which images need to be fetched
        const needsFetch = {
          blur: !cachedBlur,
          lowQuality: !cachedLowQuality,
          original: !cachedOriginal,
        };

        // If all are cached, we're done
        if (!needsFetch.blur && !needsFetch.lowQuality && !needsFetch.original) {
          setLoading(false);
          return;
        }

        // Fetch missing variants in parallel
        const fetchPromises = [];
        const fetchTypes = [];

        if (needsFetch.blur) {
          fetchPromises.push(api.getFileBlur(fileId));
          fetchTypes.push('blur');
        }
        if (needsFetch.lowQuality) {
          fetchPromises.push(api.getFileLowQuality(fileId));
          fetchTypes.push('lowQuality');
        }
        if (needsFetch.original) {
          fetchPromises.push(api.getFilePreview(fileId));
          fetchTypes.push('original');
        }

        const results = await Promise.allSettled(fetchPromises);

        if (!mounted) return;

        // Process results and cache them
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const type = fetchTypes[i];

          if (result.status === "fulfilled") {
            // Cache the blob
            const cacheType = type === 'lowQuality' ? 'low-quality' : type;
            await setCachedImage(fileId, result.value.data, cacheType);

            const url = URL.createObjectURL(result.value.data);
            
            if (type === 'blur') {
              setBlurUrl(url);
            } else if (type === 'lowQuality') {
              setLowQualityUrl(url);
            } else if (type === 'original') {
              setOriginalUrl(url);
            }
          } else {
            if (type === 'original') {
              console.error("Failed to load original image:", result.reason);
              setError("Failed to load image");
            } else {
              console.warn(`Failed to load ${type} image:`, result.reason);
            }
          }
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
        // First, check if we have a cached version
        const cachedBlob = await getCachedImage(fileId, 'thumbnail');
        
        if (cachedBlob && mounted) {
          const url = URL.createObjectURL(cachedBlob);
          setThumbnailUrl(url);
          setLoading(false);
          return;
        }

        // Not in cache, fetch from server
        const response = await api.getFileThumbnail(fileId);
        
        if (mounted) {
          // Cache the blob for future use
          await setCachedImage(fileId, response.data, 'thumbnail');
          
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
