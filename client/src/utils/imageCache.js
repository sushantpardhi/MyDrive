/**
 * Image Cache Utility
 * Uses the Cache API to store and retrieve thumbnail images
 * This allows images to persist across page refreshes
 */

const CACHE_NAME = 'mydrive-image-cache-v1';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Check if Cache API is available
const isCacheAvailable = 'caches' in window;

/**
 * Get the cache instance
 */
const getCache = async () => {
  if (!isCacheAvailable) return null;
  return await caches.open(CACHE_NAME);
};

/**
 * Generate a cache key for a file
 */
const getCacheKey = (fileId, type = 'thumbnail') => {
  return `/${type}/${fileId}`;
};

/**
 * Get a cached image blob
 * @param {string} fileId - The file ID
 * @param {string} type - The image type (thumbnail, blur, low-quality)
 * @returns {Promise<Blob|null>} - The cached blob or null if not found
 */
export const getCachedImage = async (fileId, type = 'thumbnail') => {
  if (!isCacheAvailable) return null;
  
  try {
    const cache = await getCache();
    if (!cache) return null;
    
    const cacheKey = getCacheKey(fileId, type);
    const response = await cache.match(cacheKey);
    
    if (!response) return null;
    
    // Check if cache has expired
    const cachedAt = response.headers.get('x-cached-at');
    if (cachedAt) {
      const age = Date.now() - parseInt(cachedAt, 10);
      if (age > CACHE_MAX_AGE) {
        // Cache expired, delete it
        await cache.delete(cacheKey);
        return null;
      }
    }
    
    return await response.blob();
  } catch (error) {
    console.warn('Error reading from image cache:', error);
    return null;
  }
};

/**
 * Store an image blob in cache
 * @param {string} fileId - The file ID
 * @param {Blob} blob - The image blob to cache
 * @param {string} type - The image type (thumbnail, blur, low-quality)
 */
export const setCachedImage = async (fileId, blob, type = 'thumbnail') => {
  if (!isCacheAvailable) return;
  
  try {
    const cache = await getCache();
    if (!cache) return;
    
    const cacheKey = getCacheKey(fileId, type);
    
    // Create a response with custom headers
    const response = new Response(blob, {
      headers: {
        'Content-Type': blob.type || 'image/webp',
        'x-cached-at': Date.now().toString(),
        'x-file-id': fileId,
      },
    });
    
    await cache.put(cacheKey, response);
  } catch (error) {
    console.warn('Error writing to image cache:', error);
  }
};

/**
 * Remove a specific file's cached images
 * @param {string} fileId - The file ID to remove from cache
 */
export const removeCachedImage = async (fileId) => {
  if (!isCacheAvailable) return;
  
  try {
    const cache = await getCache();
    if (!cache) return;
    
    // Remove all image types for this file
    const types = ['thumbnail', 'blur', 'low-quality'];
    await Promise.all(
      types.map(type => cache.delete(getCacheKey(fileId, type)))
    );
  } catch (error) {
    console.warn('Error removing from image cache:', error);
  }
};

/**
 * Clear all cached images
 */
export const clearImageCache = async () => {
  if (!isCacheAvailable) return;
  
  try {
    await caches.delete(CACHE_NAME);
  } catch (error) {
    console.warn('Error clearing image cache:', error);
  }
};

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = async () => {
  if (!isCacheAvailable) return;
  
  try {
    const cache = await getCache();
    if (!cache) return;
    
    const keys = await cache.keys();
    const now = Date.now();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const cachedAt = response.headers.get('x-cached-at');
        if (cachedAt) {
          const age = now - parseInt(cachedAt, 10);
          if (age > CACHE_MAX_AGE) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error cleaning up image cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  if (!isCacheAvailable) return { count: 0, available: false };
  
  try {
    const cache = await getCache();
    if (!cache) return { count: 0, available: true };
    
    const keys = await cache.keys();
    return { count: keys.length, available: true };
  } catch (error) {
    console.warn('Error getting cache stats:', error);
    return { count: 0, available: true, error: error.message };
  }
};

export default {
  getCachedImage,
  setCachedImage,
  removeCachedImage,
  clearImageCache,
  cleanupExpiredCache,
  getCacheStats,
};
