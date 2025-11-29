/**
 * Format file size in bytes to human readable format
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format date to localized string
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Get appropriate icon for file type
 */
export const getFileIcon = (fileName) => {
  // Handle undefined, null, or empty fileName
  if (!fileName || typeof fileName !== "string") {
    return "📄"; // Default icon for unknown file types
  }

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "📄"; // No extension found
  }

  const ext = fileName.substring(dotIndex + 1).toLowerCase();
  const icons = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📽️",
    pptx: "📽️",
    txt: "📝",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    bmp: "🖼️",
    webp: "🖼️",
    heic: "🖼️",
    heif: "🖼️",
    avif: "🖼️",
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    aac: "🎵",
    mp4: "🎥",
    avi: "🎥",
    mov: "🎥",
    wmv: "🎥",
    mkv: "🎥",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    tar: "📦",
    gz: "📦",
    js: "💻",
    jsx: "💻",
    ts: "💻",
    tsx: "💻",
    html: "🌐",
    css: "🎨",
    json: "📋",
    xml: "📋",
    csv: "📊",
    md: "📝",
  };
  return icons[ext] || "📄";
};
