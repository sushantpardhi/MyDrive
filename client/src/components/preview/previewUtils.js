import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  File,
  BookOpen,
  Type,
  Diff,
  Box,
} from "lucide-react";

/**
 * Detect file type category from filename
 */
export const getFileType = (filename) => {
  if (!filename) return "unknown";
  const ext = filename.split(".").pop().toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext))
    return "image";
  if (ext === "svg") return "svg";
  if (ext === "pdf") return "pdf";
  if (["xlsx", "xls", "xlsm", "xlsb", "csv"].includes(ext)) return "excel";
  if (["docx", "doc"].includes(ext)) return "word";
  if (["pptx", "ppt"].includes(ext)) return "powerpoint";
  if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "m4a"].includes(ext)) return "audio";
  if (ext === "md") return "markdown";
  if (ext === "json") return "json";
  if (["diff", "patch"].includes(ext)) return "diff";
  if (["srt", "vtt"].includes(ext)) return "subtitle";
  if (ext === "epub") return "epub";
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return "font";
  if (["obj", "stl", "gltf", "glb"].includes(ext)) return "3d";
  if (
    [
      "txt",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "php",
      "rb",
      "swift",
      "kt",
      "scala",
      "html",
      "css",
      "scss",
      "less",
      "xml",
      "yaml",
      "yml",
      "sql",
      "sh",
      "bash",
      "dockerfile",
    ].includes(ext)
  )
    return "text";
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext))
    return "archive";

  return "unknown";
};

/**
 * Get file type category label & color for badges
 */
export const getFileTypeCategory = (filename) => {
  if (!filename) return { label: "File", color: "#888" };
  const ext = filename.split(".").pop().toLowerCase();

  const categories = {
    image: {
      exts: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"],
      label: "Image",
      color: "#4CAF50",
    },
    pdf: { exts: ["pdf"], label: "PDF", color: "#F44336" },
    document: {
      exts: ["docx", "doc", "txt", "md"],
      label: "Document",
      color: "#2196F3",
    },
    spreadsheet: {
      exts: ["xlsx", "xls", "xlsm", "xlsb", "csv"],
      label: "Spreadsheet",
      color: "#4CAF50",
    },
    video: {
      exts: ["mp4", "webm", "ogg", "mov", "avi", "mkv"],
      label: "Video",
      color: "#9C27B0",
    },
    audio: {
      exts: ["mp3", "wav", "ogg", "flac", "m4a"],
      label: "Audio",
      color: "#FF9800",
    },
    code: {
      exts: ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "html", "css"],
      label: "Code",
      color: "#00BCD4",
    },
    archive: {
      exts: ["zip", "rar", "7z", "tar", "gz"],
      label: "Archive",
      color: "#795548",
    },
    model: {
      exts: ["obj", "stl", "gltf", "glb"],
      label: "3D Model",
      color: "#E91E63",
    },
  };

  for (const [, value] of Object.entries(categories)) {
    if (value.exts.includes(ext)) return value;
  }

  return { label: ext.toUpperCase(), color: "#888" };
};

/**
 * Get Lucide icon component for file type
 */
export const getFileTypeIcon = (filename) => {
  if (!filename) return File;
  const ext = filename.split(".").pop().toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext))
    return FileImage;
  if (ext === "pdf") return FileText;
  if (["xlsx", "xls", "xlsm", "xlsb", "csv"].includes(ext))
    return FileSpreadsheet;
  if (["docx", "doc", "txt"].includes(ext)) return FileText;
  if (ext === "md") return FileText;
  if (["pptx", "ppt"].includes(ext)) return FileSpreadsheet;
  if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext))
    return FileVideo;
  if (["mp3", "wav", "flac", "m4a"].includes(ext)) return FileAudio;
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "c",
      "cpp",
      "cs",
      "go",
      "rs",
      "php",
      "rb",
      "swift",
      "kt",
      "scala",
      "html",
      "css",
      "scss",
      "less",
      "json",
      "xml",
      "yaml",
      "yml",
      "sql",
      "sh",
      "bash",
      "dockerfile",
    ].includes(ext)
  )
    return FileCode;
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext))
    return FileArchive;
  if (ext === "epub") return BookOpen;
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return Type;
  if (["obj", "stl", "gltf", "glb"].includes(ext)) return Box;
  if (["diff", "patch"].includes(ext)) return Diff;
  if (["srt", "vtt"].includes(ext)) return FileText;

  return File;
};

/**
 * Get syntax highlighting language string
 */
export const getLanguage = (filename) => {
  if (!filename) return "text";
  const ext = filename.split(".").pop().toLowerCase();
  const langMap = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
    md: "markdown",
    txt: "text",
  };
  return langMap[ext] || "text";
};

/**
 * Parse subtitle files (SRT/VTT)
 */
export const parseSubtitles = (text, format) => {
  const subtitles = [];

  if (format === "srt") {
    const blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(
          /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
        );
        if (timeMatch) {
          subtitles.push({
            start: timeMatch[1],
            end: timeMatch[2],
            text: lines.slice(2).join("\n"),
          });
        }
      }
    });
  } else if (format === "vtt") {
    const blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach((block, index) => {
      if (index === 0 && block.startsWith("WEBVTT")) return;
      const lines = block.trim().split("\n");
      if (lines.length >= 2) {
        const timeMatch = lines[0].match(
          /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/,
        );
        if (timeMatch) {
          subtitles.push({
            start: timeMatch[1],
            end: timeMatch[2],
            text: lines.slice(1).join("\n"),
          });
        }
      }
    });
  }

  return subtitles;
};
