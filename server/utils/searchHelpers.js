/**
 * Advanced search helpers for MyDrive
 * Provides fuzzy matching, filtering, and sorting capabilities
 */

/**
 * Escape special regex characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build search query with advanced filters
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query string
 * @param {string} params.userId - User ID for ownership filtering
 * @param {Array<string>} params.fileTypes - File type filter (e.g., ['pdf', 'jpg'])
 * @param {Object} params.sizeRange - Size filter {min: number, max: number} in bytes
 * @param {Object} params.dateRange - Date filter {start: Date, end: Date}
 * @param {boolean} params.trash - Include trash items
 * @param {string} params.sortBy - Sort field (name, createdAt, updatedAt, size)
 * @param {string} params.sortOrder - Sort order (asc, desc)
 * @returns {Object} MongoDB query object
 */
function buildSearchQuery({
  query,
  userId,
  fileTypes = [],
  sizeRange = {},
  dateRange = {},
  trash = false,
  folderId = null,
}) {
  const searchQuery = {
    owner: userId,
    trash: trash,
  };

  // Partial word search using regex for better fuzzy matching
  if (query && query.trim()) {
    // Split query into words for partial matching
    const words = query.trim().split(/\s+/);
    if (words.length === 1) {
      // Single word - partial match anywhere in the name
      searchQuery.name = new RegExp(escapeRegex(words[0]), "i");
    } else {
      // Multiple words - match any word (OR logic)
      searchQuery.$or = words.map((word) => ({
        name: new RegExp(escapeRegex(word), "i"),
      }));
    }
  }

  // File type filter (extension-based)
  // Combine with name search if both exist
  if (fileTypes && fileTypes.length > 0) {
    const typePatterns = fileTypes.map(
      (type) => new RegExp(`\\.${escapeRegex(type)}$`, "i")
    );

    // If there's already a name search, combine with AND logic
    if (searchQuery.name || searchQuery.$or) {
      const nameCondition = searchQuery.$or || [{ name: searchQuery.name }];
      delete searchQuery.name;
      delete searchQuery.$or;

      searchQuery.$and = [
        { $or: nameCondition },
        { $or: typePatterns.map((pattern) => ({ name: pattern })) },
      ];
    } else {
      searchQuery.$or = typePatterns.map((pattern) => ({ name: pattern }));
    }
  }

  // Size range filter (for files only)
  if (sizeRange.min !== undefined || sizeRange.max !== undefined) {
    searchQuery.size = {};
    if (sizeRange.min !== undefined) {
      searchQuery.size.$gte = parseInt(sizeRange.min);
    }
    if (sizeRange.max !== undefined) {
      searchQuery.size.$lte = parseInt(sizeRange.max);
    }
  }

  // Date range filter
  if (dateRange.start || dateRange.end) {
    searchQuery.createdAt = {};
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      searchQuery.createdAt.$gte = startDate;
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      searchQuery.createdAt.$lte = endDate;
    }
  }

  // Folder filter (search within specific folder)
  if (folderId) {
    searchQuery.parent = folderId;
  }

  return searchQuery;
}

/**
 * Build fallback regex search query when text index isn't used
 * Provides fuzzy matching capabilities
 * @param {string} query - Search query string
 * @returns {Object} Regex query object
 */
function buildFuzzyQuery(query) {
  if (!query || !query.trim()) {
    return {};
  }

  // Split query into words and create regex for each
  const words = query.trim().split(/\s+/);

  if (words.length === 1) {
    // Single word - case insensitive match
    return { name: new RegExp(escapeRegex(words[0]), "i") };
  }

  // Multiple words - match any word (OR logic)
  const wordPatterns = words.map((word) => ({
    name: new RegExp(escapeRegex(word), "i"),
  }));

  return { $or: wordPatterns };
}

/**
 * Build sort options for MongoDB query
 * @param {string} sortBy - Sort field
 * @param {string} sortOrder - Sort order (asc/desc)
 * @param {boolean} hasTextSearch - Whether text search is active
 * @returns {Object} MongoDB sort object
 */
function buildSortOptions(
  sortBy = "createdAt",
  sortOrder = "desc",
  hasTextSearch = false
) {
  const sort = {};

  // Add primary sort field
  const order = sortOrder === "asc" ? 1 : -1;

  switch (sortBy) {
    case "name":
      sort.name = order;
      break;
    case "size":
      sort.size = order;
      break;
    case "updatedAt":
      sort.updatedAt = order;
      break;
    case "createdAt":
    default:
      sort.createdAt = order;
      break;
  }

  return sort;
}

/**
 * Calculate search relevance score
 * @param {string} searchTerm - Original search term
 * @param {string} resultName - Result item name
 * @returns {number} Relevance score (0-100)
 */
function calculateRelevance(searchTerm, resultName) {
  if (!searchTerm || !resultName) return 0;

  const term = searchTerm.toLowerCase();
  const name = resultName.toLowerCase();

  // Exact match
  if (name === term) return 100;

  // Starts with search term
  if (name.startsWith(term)) return 90;

  // Contains search term as whole word
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  if (wordBoundaryRegex.test(name)) return 80;

  // Contains search term
  if (name.includes(term)) return 70;

  // Word-by-word matching
  const searchWords = term.split(/\s+/);
  const nameWords = name.split(/\s+/);
  const matchedWords = searchWords.filter((word) =>
    nameWords.some((nameWord) => nameWord.includes(word))
  );

  return Math.round((matchedWords.length / searchWords.length) * 60);
}

/**
 * Get popular file type categories
 * @returns {Object} File type categories
 */
function getFileTypeCategories() {
  return {
    documents: ["pdf", "doc", "docx", "txt", "rtf", "odt"],
    spreadsheets: ["xlsx", "xls", "csv", "ods"],
    presentations: ["ppt", "pptx", "odp"],
    images: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "heic"],
    videos: ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"],
    audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
    archives: ["zip", "rar", "7z", "tar", "gz"],
    code: [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "c",
      "go",
      "rs",
      "php",
      "rb",
    ],
    "3d": ["stl", "obj", "gltf", "glb", "fbx"],
    fonts: ["ttf", "otf", "woff", "woff2"],
    ebooks: ["epub", "mobi", "azw3"],
  };
}

/**
 * Get file extensions from category
 * @param {string} category - Category name
 * @returns {Array<string>} File extensions
 */
function getExtensionsFromCategory(category) {
  const categories = getFileTypeCategories();
  return categories[category] || [];
}

/**
 * Format search results with highlights
 * @param {Array} results - Search results
 * @param {string} searchTerm - Search term
 * @returns {Array} Results with highlights
 */
function addSearchHighlights(results, searchTerm) {
  if (!searchTerm) return results;

  return results.map((item) => {
    const relevance = calculateRelevance(searchTerm, item.name);
    // Convert to plain object to preserve all properties including populated fields
    const itemObj = item.toObject ? item.toObject() : item;
    return {
      ...itemObj,
      _searchMeta: {
        relevance,
        highlight: highlightText(item.name, searchTerm),
      },
    };
  });
}

/**
 * Highlight matching text
 * @param {string} text - Original text
 * @param {string} searchTerm - Search term
 * @returns {string} Text with markers for highlighting
 */
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
  return text.replace(regex, "{{HIGHLIGHT}}$1{{/HIGHLIGHT}}");
}

/**
 * Get search suggestions based on partial query
 * @param {Array} allItems - All available items
 * @param {string} partialQuery - Partial search query
 * @param {number} limit - Max suggestions
 * @returns {Array<string>} Suggested search terms
 */
function getSearchSuggestions(allItems, partialQuery, limit = 5) {
  if (!partialQuery || partialQuery.length < 2) return [];

  const query = partialQuery.toLowerCase();
  const suggestions = new Set();

  allItems.forEach((item) => {
    const name = item.name.toLowerCase();
    if (name.includes(query)) {
      // Add the full name
      suggestions.add(item.name);

      // Add individual words that match
      const words = item.name.split(/[\s_.-]+/);
      words.forEach((word) => {
        if (word.toLowerCase().includes(query)) {
          suggestions.add(word);
        }
      });
    }
  });

  return Array.from(suggestions).slice(0, limit);
}

module.exports = {
  buildSearchQuery,
  buildFuzzyQuery,
  buildSortOptions,
  calculateRelevance,
  getFileTypeCategories,
  getExtensionsFromCategory,
  addSearchHighlights,
  highlightText,
  getSearchSuggestions,
  escapeRegex,
};
