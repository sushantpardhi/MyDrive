import styles from "./SearchHighlight.module.css";

/**
 * Component to highlight search terms in text
 * @param {string} text - The original text to highlight
 * @param {string} searchTerm - The search term to highlight
 * @param {Object} searchMeta - Optional search metadata from backend
 */
const SearchHighlight = ({ text, searchTerm, searchMeta }) => {
  if (!text) return null;
  if (!searchTerm || searchTerm.trim().length === 0) {
    return <span>{text}</span>;
  }

  // If backend provided highlight markers, use those
  if (searchMeta?.highlight) {
    const parts = searchMeta.highlight.split(
      /(\{\{HIGHLIGHT\}\}|\{\{\/HIGHLIGHT\}\})/
    );
    let isHighlighted = false;

    return (
      <span>
        {parts.map((part, index) => {
          if (part === "{{HIGHLIGHT}}") {
            isHighlighted = true;
            return null;
          }
          if (part === "{{/HIGHLIGHT}}") {
            isHighlighted = false;
            return null;
          }
          return isHighlighted ? (
            <mark key={index} className={styles.highlight}>
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </span>
    );
  }

  // Client-side highlighting fallback
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          return (
            <mark key={index} className={styles.highlight}>
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

/**
 * Escape special regex characters
 */
const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export default SearchHighlight;
