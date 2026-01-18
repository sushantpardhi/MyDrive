import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JsonView from "@uiw/react-json-view";
import JSZip from "jszip";
import ePub from "epubjs";
import opentype from "opentype.js";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import ProgressiveImage from "../common/ProgressiveImage";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize2,
  Minimize2,
  Loader,
  FileSpreadsheet,
  FileText,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  FileImage,
  File,
  Share2,
  Info,
  Code2,
  Eye,
  Move,
  Folder,
  BookOpen,
  Type,
  Diff,
  Box,
  Printer,
  Edit3,
  Trash2,
  Copy,
  ChevronDown,
  Calendar,
  User,
  HardDrive,
  Link,
  Clock,
  Tag,
  Keyboard,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import LoadingSpinner from "../common/LoadingSpinner";
import styles from "./PreviewModal.module.css";
import api from "../../services/api";
import { useUIContext } from "../../contexts";
import { formatFileSize } from "../../utils/formatters";

// Configure PDF.js worker - must match the version react-pdf uses (5.4.296)
// Note: pdfjs-dist 5.x uses .mjs files
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

// Helper function to parse subtitle files
const parseSubtitles = (text, format) => {
  const subtitles = [];

  if (format === "srt") {
    const blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(
          /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
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
      if (index === 0 && block.startsWith("WEBVTT")) return; // Skip header
      const lines = block.trim().split("\n");
      if (lines.length >= 2) {
        const timeMatch = lines[0].match(
          /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
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

// 3D Model Component
const Model3D = ({ url, fileType }) => {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ext = fileType.split(".").pop().toLowerCase();
    let loader;

    if (ext === "stl") {
      loader = new STLLoader();
    } else if (ext === "obj") {
      loader = new OBJLoader();
    } else if (ext === "gltf" || ext === "glb") {
      loader = new GLTFLoader();
    }

    if (loader) {
      loader.load(
        url,
        (result) => {
          if (ext === "gltf" || ext === "glb") {
            setModel(result.scene);
          } else if (ext === "stl") {
            const geometry = result;
            const material = new THREE.MeshStandardMaterial({
              color: 0x888888,
            });
            const mesh = new THREE.Mesh(geometry, material);
            setModel(mesh);
          } else {
            setModel(result);
          }
        },
        undefined,
        (err) => {
          console.error("Error loading 3D model:", err);
          setError("Failed to load 3D model");
        }
      );
    }
  }, [url, fileType]);

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner size="medium" message="Loading 3D model..." />
      </div>
    );
  }

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <Stage environment="city" intensity={0.6}>
        <primitive object={model} />
      </Stage>
      <OrbitControls />
    </Canvas>
  );
};

const PreviewModal = () => {
  const { 
    previewModalOpen, 
    previewFile, 
    previewFileList, 
    previewFileIndex, 
    closePreviewModal,
    goToPreviousFile,
    goToNextFile 
  } = useUIContext();
  const [fileUrl, setFileUrl] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Progressive image loading URLs
  const [blurUrl, setBlurUrl] = useState(null);
  const [lowQualityUrl, setLowQualityUrl] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);

  // PDF-specific state - store as ArrayBuffer for better compatibility
  const [pdfData, setPdfData] = useState(null);

  // Image viewer state
  const [imageZoom, setImageZoom] = useState(100);
  const [imageRotation, setImageRotation] = useState(0);

  // PDF viewer state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(1.0);

  // Excel viewer state
  const [excelData, setExcelData] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [currentSheet, setCurrentSheet] = useState(0);

  // Word viewer state
  const [wordHtml, setWordHtml] = useState(null);

  // Google Docs Viewer fallback
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);

  // Full screen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Archive viewer state
  const [archiveContents, setArchiveContents] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // SVG viewer state
  const [svgViewMode, setSvgViewMode] = useState("render"); // "render" or "code"

  // Image enhanced state
  const [imageDimensions, setImageDimensions] = useState(null);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageFitMode, setImageFitMode] = useState("fit"); // "fit" or "actual"

  // EPUB viewer state
  const [epubBook, setEpubBook] = useState(null);
  const [epubRendition, setEpubRendition] = useState(null);
  const epubViewerRef = useRef(null);

  // Font viewer state
  const [fontData, setFontData] = useState(null);
  const [fontPreviewText, setFontPreviewText] = useState(
    "The quick brown fox jumps over the lazy dog"
  );

  // 3D model viewer state
  const [modelData, setModelData] = useState(null);

  // Subtitle viewer state
  const [subtitleContent, setSubtitleContent] = useState([]);

  // JSON viewer state
  const [jsonData, setJsonData] = useState(null);

  // Metadata sidebar state
  const [metadataSidebarOpen, setMetadataSidebarOpen] = useState(false);

  // Keyboard shortcuts help state
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Quick actions menu state
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Get file extension and type
  const getFileType = (filename) => {
    if (!filename) return "unknown";
    const ext = filename.split(".").pop().toLowerCase();

    // Image types
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) {
      return "image";
    }

    // SVG (special handling)
    if (ext === "svg") {
      return "svg";
    }

    // PDF
    if (ext === "pdf") {
      return "pdf";
    }

    // Excel types
    if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) {
      return "excel";
    }

    // CSV (separate from Excel for potential different handling)
    if (ext === "csv") {
      return "excel";
    }

    // Word types
    if (["docx", "doc"].includes(ext)) {
      return "word";
    }

    // PowerPoint types
    if (["pptx", "ppt"].includes(ext)) {
      return "powerpoint";
    }

    // Video types
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) {
      return "video";
    }

    // Audio types
    if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) {
      return "audio";
    }

    // Markdown (special rendering)
    if (ext === "md") {
      return "markdown";
    }

    // JSON (special tree view)
    if (ext === "json") {
      return "json";
    }

    // Diff/Patch files
    if (["diff", "patch"].includes(ext)) {
      return "diff";
    }

    // Subtitle files
    if (["srt", "vtt"].includes(ext)) {
      return "subtitle";
    }

    // EPUB files
    if (ext === "epub") {
      return "epub";
    }

    // Font files
    if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
      return "font";
    }

    // 3D model files
    if (["obj", "stl", "gltf", "glb"].includes(ext)) {
      return "3d";
    }

    // Text/Code types (excluding md and json which are handled separately)
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
    ) {
      return "text";
    }

    // Archive types
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
      return "archive";
    }

    // For any other file type, show generic preview with icon
    return "unknown";
  };

  // Get file type category for badge
  const getFileTypeCategory = (filename) => {
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
        exts: [
          "js",
          "jsx",
          "ts",
          "tsx",
          "py",
          "java",
          "c",
          "cpp",
          "html",
          "css",
        ],
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

    for (const [key, value] of Object.entries(categories)) {
      if (value.exts.includes(ext)) return value;
    }

    return { label: ext.toUpperCase(), color: "#888" };
  };

  // Get icon for file type
  const getFileTypeIcon = (filename) => {
    if (!filename) return File;
    const ext = filename.split(".").pop().toLowerCase();

    // Images
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) {
      return FileImage;
    }

    // PDF
    if (ext === "pdf") {
      return FileText;
    }

    // Excel/Spreadsheet
    if (["xlsx", "xls", "xlsm", "xlsb", "csv"].includes(ext)) {
      return FileSpreadsheet;
    }

    // Word/Documents
    if (["docx", "doc", "txt"].includes(ext)) {
      return FileText;
    }

    // Markdown
    if (ext === "md") {
      return FileText;
    }

    // PowerPoint
    if (["pptx", "ppt"].includes(ext)) {
      return FileSpreadsheet;
    }

    // Video
    if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) {
      return FileVideo;
    }

    // Audio
    if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) {
      return FileAudio;
    }

    // Code files
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
    ) {
      return FileCode;
    }

    // Archives
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
      return FileArchive;
    }

    // EPUB
    if (ext === "epub") {
      return BookOpen;
    }

    // Fonts
    if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
      return Type;
    }

    // 3D Models
    if (["obj", "stl", "gltf", "glb"].includes(ext)) {
      return Box;
    }

    // Diff files
    if (["diff", "patch"].includes(ext)) {
      return Diff;
    }

    // Subtitles
    if (["srt", "vtt"].includes(ext)) {
      return FileText;
    }

    return File;
  };

  // Get syntax highlighting language
  const getLanguage = (filename) => {
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

  // Load file content
  useEffect(() => {
    let cancelled = false; // Flag to prevent state updates after unmount

    if (!previewModalOpen || !previewFile) {
      setFileUrl(null);
      setFileContent(null);
      setPdfData(null);
      setExcelData(null);
      setExcelSheets([]);
      setCurrentSheet(0);
      setWordHtml(null);
      setUseGoogleViewer(false);
      setError(null);
      // Clean up progressive image URLs
      setBlurUrl(null);
      setLowQualityUrl(null);
      setOriginalUrl(null);
      return;
    }

    const loadFile = async () => {
      if (cancelled) return;

      setLoading(true);
      setError(null);

      try {
        const fileType = getFileType(previewFile.name);

        // Handle images with progressive loading
        if (fileType === "image") {
          if (cancelled) return;

          // Load all image variants independently (parallel, non-blocking)
          // Each variant loads independently and updates the UI as soon as it's ready
          
          // 1. Load blur image immediately (smallest, fastest)
          api.getFileBlur(previewFile._id)
            .then(blurResponse => {
              if (!cancelled) {
                const blurBlobUrl = URL.createObjectURL(blurResponse.data);
                setBlurUrl(blurBlobUrl);
                setLoading(false); // Hide loading spinner as soon as blur is ready
                console.log("[PreviewModal] Blur image loaded");
              }
            })
            .catch(error => {
              console.log("[PreviewModal] Blur image not available:", error.message);
            });

          // 2. Load low-quality image independently (medium size, medium speed)
          api.getFileLowQuality(previewFile._id)
            .then(lowQualityResponse => {
              if (!cancelled) {
                const lowQualityBlobUrl = URL.createObjectURL(lowQualityResponse.data);
                setLowQualityUrl(lowQualityBlobUrl);
                setLoading(false); // Hide loading spinner if not already hidden
                console.log("[PreviewModal] Low-quality image loaded");
              }
            })
            .catch(error => {
              console.log("[PreviewModal] Low-quality image not available:", error.message);
            });

          // 3. Load original image independently (largest, slowest)
          api.getFilePreview(previewFile._id)
            .then(originalResponse => {
              if (!cancelled) {
                const originalBlobUrl = URL.createObjectURL(originalResponse.data);
                setOriginalUrl(originalBlobUrl);
                setLoading(false); // Hide loading spinner if not already hidden
                console.log("[PreviewModal] Original image loaded");

                // Get image dimensions from original
                const img = new Image();
                img.onload = () => {
                  if (!cancelled) {
                    setImageDimensions({ width: img.width, height: img.height });
                  }
                };
                img.onerror = (e) => {
                  if (!cancelled) {
                    setError("Failed to load image");
                    setLoading(false);
                  }
                };
                img.src = originalBlobUrl;
              }
            })
            .catch(error => {
              console.error("[PreviewModal] Failed to load original image:", error);
              if (!cancelled) {
                setError("Failed to load original image");
                setLoading(false);
              }
            });

          return;
        }

        // Handle PDFs differently - use blob URL to avoid cloning issues
        if (fileType === "pdf") {
          if (cancelled) return;
          const response = await api.getFilePreview(previewFile._id);
          // Use blob URL - most reliable approach for react-pdf
          const url = URL.createObjectURL(response.data);
          setPdfData(url);
        }
        // Create blob URL for other media files
        else if (["video", "audio", "svg"].includes(fileType)) {
          if (cancelled) return;
          const response = await api.getFilePreview(previewFile._id);

          const url = URL.createObjectURL(response.data);
          setFileUrl(url);

          // Get image dimensions for SVG
          if (fileType === "svg") {
            const img = new Image();
            img.onload = () => {
              if (!cancelled) {
                setImageDimensions({ width: img.width, height: img.height });
              }
            };
            img.onerror = (e) => {
              if (!cancelled) {
                setError("Failed to load SVG");
                setLoading(false);
              }
            };
            img.src = url;
          }
        }

        const response = await api.getFilePreview(previewFile._id);

        // Read text content for text files
        if (fileType === "text") {
          const text = await response.data.text();
          if (cancelled) return;
          setFileContent(text);
        }

        // Parse Markdown files
        if (fileType === "markdown") {
          const text = await response.data.text();
          if (cancelled) return;
          setFileContent(text);
        }

        // Parse JSON files
        if (fileType === "json") {
          const text = await response.data.text();
          if (cancelled) return;
          try {
            const parsed = JSON.parse(text);
            setJsonData(parsed);
          } catch (e) {
            setError("Invalid JSON file");
          }
        }

        // Parse Excel files
        if (fileType === "excel") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          setExcelSheets(workbook.SheetNames);
          setExcelData(workbook);
          setCurrentSheet(0);
        }

        // Parse Word documents
        if (fileType === "word") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setWordHtml(result.value);
        }

        // Parse Archive files (ZIP)
        if (fileType === "archive") {
          const ext = previewFile.name.split(".").pop().toLowerCase();
          if (ext === "zip") {
            const arrayBuffer = await response.data.arrayBuffer();
            if (cancelled) return;
            try {
              setArchiveLoading(true);
              const zip = await JSZip.loadAsync(arrayBuffer);
              const files = [];
              zip.forEach((relativePath, file) => {
                files.push({
                  name: relativePath,
                  size: file._data ? file._data.uncompressedSize : 0,
                  isFolder: file.dir,
                });
              });
              setArchiveContents(files);
            } catch (e) {
              console.error("Error reading ZIP:", e);
              setError("Failed to read archive contents");
            } finally {
              setArchiveLoading(false);
            }
          }
        }

        // Parse EPUB files
        if (fileType === "epub") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          try {
            const book = ePub(arrayBuffer);
            setEpubBook(book);
          } catch (e) {
            console.error("Error loading EPUB:", e);
            setError("Failed to load EPUB file");
          }
        }

        // Parse Font files
        if (fileType === "font") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          try {
            const font = opentype.parse(arrayBuffer);
            setFontData(font);
          } catch (e) {
            console.error("Error loading font:", e);
            setError("Failed to load font file");
          }
        }

        // Parse 3D model files
        if (fileType === "3d") {
          const url = URL.createObjectURL(response.data);
          if (cancelled) return;
          setFileUrl(url);
        }

        // Parse Subtitle files
        if (fileType === "subtitle") {
          const text = await response.data.text();
          if (cancelled) return;
          const parsed = parseSubtitles(
            text,
            previewFile.name.endsWith(".srt") ? "srt" : "vtt"
          );
          setSubtitleContent(parsed);
        }

        // Parse Diff files
        if (fileType === "diff") {
          const text = await response.data.text();
          if (cancelled) return;
          setFileContent(text);
        }

        // PowerPoint preview via URL
        if (fileType === "powerpoint") {
          const url = URL.createObjectURL(response.data);
          if (cancelled) return;
          setFileUrl(url);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("✗ Error loading file preview:", err);
        setError("Failed to load file preview. Please try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setError(null);
    loadFile();

    // Cleanup blob URLs on unmount and set cancelled flag
    return () => {
      cancelled = true;
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      if (
        pdfData &&
        typeof pdfData === "string" &&
        pdfData.startsWith("blob:")
      ) {
        URL.revokeObjectURL(pdfData);
      }
      // Clean up progressive image URLs
      if (blurUrl) {
        URL.revokeObjectURL(blurUrl);
      }
      if (lowQualityUrl) {
        URL.revokeObjectURL(lowQualityUrl);
      }
      if (originalUrl) {
        URL.revokeObjectURL(originalUrl);
      }
    };
  }, [previewModalOpen, previewFile]);

  // EPUB rendering effect
  useEffect(() => {
    if (epubBook && epubViewerRef.current) {
      const rendition = epubBook.renderTo(epubViewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "none",
      });
      rendition.display();
      setEpubRendition(rendition);

      return () => {
        if (rendition) {
          rendition.destroy();
        }
      };
    }
  }, [epubBook]);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!previewFile) return;

    try {
      const response = await api.downloadFile(previewFile._id);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", previewFile.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
    }
  }, [previewFile]);

  // Image controls
  const handleZoomIn = () => setImageZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setImageZoom((prev) => Math.max(prev - 25, 25));
  const handleRotate = () => setImageRotation((prev) => (prev + 90) % 360);
  const handleResetImage = () => {
    setImageZoom(100);
    setImageRotation(0);
  };

  // PDF controls
  const handlePdfZoomIn = () =>
    setPdfZoom((prev) => Math.min(prev + 0.25, 3.0));
  const handlePdfZoomOut = () =>
    setPdfZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () =>
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));

  // Excel controls
  const handlePrevSheet = () =>
    setCurrentSheet((prev) => Math.max(prev - 1, 0));
  const handleNextSheet = () =>
    setCurrentSheet((prev) => Math.min(prev + 1, excelSheets.length - 1));

  // Full screen toggle
  const toggleFullScreen = () => setIsFullScreen((prev) => !prev);

  // SVG view toggle
  const toggleSvgView = () =>
    setSvgViewMode((prev) => (prev === "render" ? "code" : "render"));

  // Image fit mode toggle
  const toggleImageFit = () =>
    setImageFitMode((prev) => (prev === "fit" ? "actual" : "fit"));

  // Image drag handlers
  const handleMouseDown = (e) => {
    if (imageFitMode === "actual") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setImagePan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // EPUB navigation
  const handleEpubPrev = () => {
    if (epubRendition) {
      epubRendition.prev();
    }
  };

  const handleEpubNext = () => {
    if (epubRendition) {
      epubRendition.next();
    }
  };

  // New handler functions for enhanced features
  const toggleMetadataSidebar = () => setMetadataSidebarOpen((prev) => !prev);

  const toggleKeyboardHelp = () => setShowKeyboardHelp((prev) => !prev);

  const toggleQuickActions = () => setQuickActionsOpen((prev) => !prev);

  const handlePrint = useCallback(() => {
    if (!previewFile) return;

    const fileType = getFileType(previewFile.name);

    if (fileType === "pdf" && pdfData) {
      window.print();
    } else if (fileType === "image" && fileUrl) {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head><title>Print ${previewFile.name}</title></head>
          <body style="margin:0;display:flex;align-items:center;justify-content:center;">
            <img src="${fileUrl}" style="max-width:100%;height:auto;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
    } else if (fileType === "text" || fileType === "markdown") {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Print ${previewFile.name}</title>
            <style>body{font-family:monospace;padding:20px;white-space:pre-wrap;}</style>
          </head>
          <body>${fileContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [previewFile, fileContent, fileUrl, pdfData]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!previewModalOpen) return;

    const handleKeyDown = (e) => {
      // Show keyboard help
      if (e.key === "?" && !e.shiftKey) {
        e.preventDefault();
        toggleKeyboardHelp();
        return;
      }

      // Close modal
      if (e.key === "Escape") {
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else {
          closePreviewModal();
        }
        return;
      }

      // Toggle metadata sidebar with 'i' key
      if (e.key === "i" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleMetadataSidebar();
        return;
      }

      // Print with Ctrl+P or Cmd+P
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Download with 'd' key
      if (e.key === "d" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleDownload();
        return;
      }

      // Fullscreen with 'f' key
      if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFullScreen();
        return;
      }

      const fileType = previewFile ? getFileType(previewFile.name) : "unknown";

      // File navigation with arrow keys (for types that don't use arrows for internal navigation)
      if (previewFileList.length > 1) {
        if (fileType === "pdf") {
          if (e.key === "ArrowLeft") handlePrevPage();
          if (e.key === "ArrowRight") handleNextPage();
          // Use Up/Down for file navigation in PDF
          if (e.key === "ArrowUp") {
            e.preventDefault();
            goToPreviousFile();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            goToNextFile();
          }
        } else if (fileType === "excel") {
          if (e.key === "ArrowLeft") handlePrevSheet();
          if (e.key === "ArrowRight") handleNextSheet();
          // Use Up/Down for file navigation in Excel
          if (e.key === "ArrowUp") {
            e.preventDefault();
            goToPreviousFile();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            goToNextFile();
          }
        } else if (fileType === "epub") {
          if (e.key === "ArrowLeft") handleEpubPrev();
          if (e.key === "ArrowRight") handleEpubNext();
          // Use Up/Down for file navigation in EPUB
          if (e.key === "ArrowUp") {
            e.preventDefault();
            goToPreviousFile();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            goToNextFile();
          }
        } else {
          // For all other file types, use Left/Right for file navigation
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            goToPreviousFile();
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goToNextFile();
          }
        }
      } else {
        // Single file or no list - keep original behavior
        if (fileType === "pdf") {
          if (e.key === "ArrowLeft") handlePrevPage();
          if (e.key === "ArrowRight") handleNextPage();
        }

        if (fileType === "excel") {
          if (e.key === "ArrowLeft") handlePrevSheet();
          if (e.key === "ArrowRight") handleNextSheet();
        }

        if (fileType === "epub") {
          if (e.key === "ArrowLeft") handleEpubPrev();
          if (e.key === "ArrowRight") handleEpubNext();
        }
      }

      if (fileType === "image" || fileType === "svg") {
        if (e.key === "+" || e.key === "=") handleZoomIn();
        if (e.key === "-") handleZoomOut();
        if (e.key === "r" || e.key === "R") handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    previewModalOpen,
    previewFile,
    closePreviewModal,
    numPages,
    excelSheets.length,
    epubRendition,
    showKeyboardHelp,
    handlePrint,
    handleDownload,
    previewFileList,
    goToPreviousFile,
    goToNextFile,
  ]);

  if (!previewModalOpen || !previewFile) {
    return null;
  }

  const fileType = getFileType(previewFile.name);

  // Check if file is previewable
  if (fileType === "unknown") {
    return (
      <div className={styles.modalOverlay} onClick={closePreviewModal}>
        <div
          className={styles.modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.fileInfo}>
              <h2>{previewFile.name}</h2>
              <span className={styles.fileSize}>
                {formatFileSize(previewFile.size)}
              </span>
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={handleDownload}
                className={styles.iconButton}
                title="Download"
              >
                <Download size={20} />
              </button>
              <button
                onClick={closePreviewModal}
                className={styles.iconButton}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className={styles.previewContainer}>
            <div className={styles.noPreview}>
              <p>Preview not available for this file type</p>
              <button
                onClick={handleDownload}
                className={styles.downloadButton}
              >
                <Download size={20} />
                Download File
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.modalOverlay} ${
        isFullScreen ? styles.fullScreen : ""
      }`}
      onClick={closePreviewModal}
    >
      {/* File Navigation Arrows */}
      {previewFileList.length > 1 && (
        <>
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousFile();
            }}
            title="Previous file (←)"
            aria-label="Previous file"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={(e) => {
              e.stopPropagation();
              goToNextFile();
            }}
            title="Next file (→)"
            aria-label="Next file"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      {/* File Counter */}
      {previewFileList.length > 1 && (
        <div className={styles.fileCounter} onClick={(e) => e.stopPropagation()}>
          {previewFileIndex + 1} / {previewFileList.length}
        </div>
      )}

      <div
        className={`${styles.modalContent} ${
          isFullScreen ? styles.fullScreenContent : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.fileInfo}>
            <div
              className={styles.fileTypeBadge}
              style={{
                backgroundColor: getFileTypeCategory(previewFile.name).color,
              }}
            >
              {getFileTypeCategory(previewFile.name).label}
            </div>
            <div className={styles.fileTitleGroup}>
              <h2>{previewFile.name}</h2>
              <span className={styles.fileSize}>
                {formatFileSize(previewFile.size)}
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            {/* Keyboard shortcuts button */}
            <button
              onClick={toggleKeyboardHelp}
              className={styles.iconButton}
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={20} />
            </button>
            {/* Type-specific controls */}
            {fileType === "image" && (
              <>
                <button
                  onClick={handleZoomOut}
                  className={styles.iconButton}
                  title="Zoom Out"
                >
                  <ZoomOut size={20} />
                </button>
                <span className={styles.zoomLevel}>{imageZoom}%</span>
                <button
                  onClick={handleZoomIn}
                  className={styles.iconButton}
                  title="Zoom In"
                >
                  <ZoomIn size={20} />
                </button>
                <button
                  onClick={handleRotate}
                  className={styles.iconButton}
                  title="Rotate"
                >
                  <RotateCw size={20} />
                </button>
                <button
                  onClick={handleResetImage}
                  className={styles.textButton}
                >
                  Reset
                </button>
              </>
            )}

            {fileType === "pdf" && (
              <>
                <button
                  onClick={handlePrevPage}
                  className={styles.iconButton}
                  title="Previous Page"
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft size={20} />
                </button>
                <span className={styles.pageInfo}>
                  Page {pageNumber} of {numPages || "?"}
                </span>
                <button
                  onClick={handleNextPage}
                  className={styles.iconButton}
                  title="Next Page"
                  disabled={pageNumber >= (numPages || 1)}
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  onClick={handlePdfZoomOut}
                  className={styles.iconButton}
                  title="Zoom Out"
                >
                  <ZoomOut size={20} />
                </button>
                <span className={styles.zoomLevel}>
                  {Math.round(pdfZoom * 100)}%
                </span>
                <button
                  onClick={handlePdfZoomIn}
                  className={styles.iconButton}
                  title="Zoom In"
                >
                  <ZoomIn size={20} />
                </button>
              </>
            )}

            {fileType === "excel" && excelSheets.length > 1 && (
              <>
                <button
                  onClick={handlePrevSheet}
                  className={styles.iconButton}
                  title="Previous Sheet"
                  disabled={currentSheet <= 0}
                >
                  <ChevronLeft size={20} />
                </button>
                <span className={styles.pageInfo}>
                  {excelSheets[currentSheet]} ({currentSheet + 1} of{" "}
                  {excelSheets.length})
                </span>
                <button
                  onClick={handleNextSheet}
                  className={styles.iconButton}
                  title="Next Sheet"
                  disabled={currentSheet >= excelSheets.length - 1}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {fileType === "svg" && (
              <>
                <button
                  onClick={toggleSvgView}
                  className={styles.textButton}
                  title={svgViewMode === "render" ? "View Code" : "View Render"}
                >
                  {svgViewMode === "render" ? (
                    <Code2 size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                  {svgViewMode === "render" ? " Code" : " Render"}
                </button>
              </>
            )}

            {(fileType === "image" || fileType === "svg") &&
              imageDimensions && (
                <>
                  <button
                    onClick={toggleImageFit}
                    className={styles.textButton}
                    title={
                      imageFitMode === "fit" ? "Actual Size" : "Fit to Screen"
                    }
                  >
                    {imageFitMode === "fit" ? "Actual Size" : "Fit"}
                  </button>
                  <span className={styles.fileSize}>
                    {imageDimensions.width} × {imageDimensions.height}
                  </span>
                </>
              )}

            {fileType === "epub" && epubRendition && (
              <>
                <button
                  onClick={handleEpubPrev}
                  className={styles.iconButton}
                  title="Previous Page"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className={styles.pageInfo}>Use arrows to navigate</span>
                <button
                  onClick={handleEpubNext}
                  className={styles.iconButton}
                  title="Next Page"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Print button for supported file types */}
            {(fileType === "pdf" ||
              fileType === "image" ||
              fileType === "text" ||
              fileType === "markdown") && (
              <button
                onClick={handlePrint}
                className={styles.iconButton}
                title="Print (Ctrl+P)"
              >
                <Printer size={20} />
              </button>
            )}

            <button
              onClick={toggleFullScreen}
              className={styles.iconButton}
              title={isFullScreen ? "Exit Full Screen (F)" : "Full Screen (F)"}
            >
              {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={toggleMetadataSidebar}
              className={`${styles.iconButton} ${
                metadataSidebarOpen ? styles.active : ""
              }`}
              title="File Info (I)"
            >
              {metadataSidebarOpen ? (
                <PanelRightClose size={20} />
              ) : (
                <PanelRightOpen size={20} />
              )}
            </button>
            <button
              onClick={handleDownload}
              className={styles.iconButton}
              title="Download (D)"
            >
              <Download size={20} />
            </button>
            <button
              onClick={closePreviewModal}
              className={styles.iconButton}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className={styles.previewContainer}>
          {loading && (
            <div className={styles.loading}>
              <LoadingSpinner size="large" message="Loading preview..." />
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button
                onClick={handleDownload}
                className={styles.downloadButton}
              >
                <Download size={20} />
                Download File
              </button>
            </div>
          )}

          {!loading && !error && fileType === "image" && (blurUrl || lowQualityUrl || originalUrl) && (
            <div className={styles.imagePreview}>
              <ProgressiveImage
                thumbnailUrl={null}
                blurUrl={blurUrl}
                lowQualityUrl={lowQualityUrl}
                originalUrl={originalUrl}
                alt={previewFile.name}
                mode="progressive"
                onLoad={() => {
                  // Callback when original image fully loads
                  console.log("Image fully loaded:", previewFile.name);
                }}
                style={{
                  transform: `scale(${
                    imageZoom / 100
                  }) rotate(${imageRotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
          )}

          {!loading && !error && fileType === "pdf" && pdfData && (
            <div className={styles.pdfPreview}>
              <Document
                file={pdfData}
                onLoadSuccess={({ numPages }) => {
                  setNumPages(numPages);
                }}
                onLoadError={(error) => {
                  console.error("Error loading PDF:", error);
                  setError(
                    `Failed to load PDF: ${error.message || "Unknown error"}`
                  );
                }}
                onSourceError={(error) => {
                  console.error("PDF source error:", error);
                }}
                loading={
                  <div className={styles.loading}>
                    <Loader className={styles.spinner} size={40} />
                    <p>Loading PDF...</p>
                  </div>
                }
                error={
                  <div className={styles.error}>
                    <p>Failed to load PDF document</p>
                    <button
                      onClick={handleDownload}
                      className={styles.downloadButton}
                    >
                      <Download size={20} />
                      Download PDF Instead
                    </button>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={pdfZoom}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div className={styles.loading}>
                      <Loader className={styles.spinner} size={32} />
                      <p>Rendering page {pageNumber}...</p>
                    </div>
                  }
                  error={
                    <div className={styles.error}>
                      <p>Failed to render page {pageNumber}</p>
                    </div>
                  }
                />
              </Document>
            </div>
          )}

          {!loading && !error && fileType === "video" && fileUrl && (
            <div className={styles.videoPreview}>
              <video controls src={fileUrl} className={styles.video}>
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {!loading && !error && fileType === "audio" && fileUrl && (
            <div className={styles.audioPreview}>
              <audio controls src={fileUrl} className={styles.audio}>
                Your browser does not support the audio tag.
              </audio>
            </div>
          )}

          {!loading && !error && fileType === "text" && fileContent && (
            <div className={styles.textPreview}>
              <SyntaxHighlighter
                language={getLanguage(previewFile.name)}
                style={vscDarkPlus}
                showLineNumbers={true}
                wrapLines={true}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.9rem",
                  maxHeight: "100%",
                  overflow: "auto",
                }}
              >
                {fileContent}
              </SyntaxHighlighter>
            </div>
          )}

          {!loading && !error && fileType === "excel" && excelData && (
            <div className={styles.excelPreview}>
              <div className={styles.excelTableWrapper}>
                {(() => {
                  const sheetName = excelSheets[currentSheet];
                  const worksheet = excelData.Sheets[sheetName];
                  const htmlString = XLSX.utils.sheet_to_html(worksheet);

                  return (
                    <div
                      className={styles.excelTable}
                      dangerouslySetInnerHTML={{ __html: htmlString }}
                    />
                  );
                })()}
              </div>
            </div>
          )}

          {!loading && !error && fileType === "word" && wordHtml && (
            <div className={styles.wordPreview}>
              <div
                className={styles.wordContent}
                dangerouslySetInnerHTML={{ __html: wordHtml }}
              />
            </div>
          )}

          {!loading && !error && fileType === "markdown" && fileContent && (
            <div className={styles.markdownPreview}>
              <div className={styles.markdownContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {fileContent}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {!loading && !error && fileType === "json" && jsonData && (
            <div className={styles.jsonPreview}>
              <JsonView value={jsonData} style={{ fontSize: "14px" }} />
            </div>
          )}

          {!loading && !error && fileType === "svg" && fileUrl && (
            <div className={styles.svgPreview}>
              {svgViewMode === "render" ? (
                <div className={styles.svgRender}>
                  <img
                    src={fileUrl}
                    alt={previewFile.name}
                    style={{
                      transform: `scale(${
                        imageZoom / 100
                      }) rotate(${imageRotation}deg) translate(${
                        imagePan.x
                      }px, ${imagePan.y}px)`,
                      transition: isDragging ? "none" : "transform 0.2s ease",
                      cursor:
                        imageFitMode === "actual"
                          ? isDragging
                            ? "grabbing"
                            : "grab"
                          : "default",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </div>
              ) : (
                <div className={styles.svgCode}>
                  <SyntaxHighlighter
                    language="xml"
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      fontSize: "0.9rem",
                      maxHeight: "100%",
                      overflow: "auto",
                    }}
                  >
                    {fileContent || ""}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          )}

          {!loading &&
            !error &&
            fileType === "archive" &&
            archiveContents.length > 0 && (
              <div className={styles.archivePreview}>
                <div className={styles.archiveHeader}>
                  <Folder size={24} />
                  <h3>Archive Contents ({archiveContents.length} items)</h3>
                </div>
                <div className={styles.archiveList}>
                  {archiveLoading ? (
                    <div className={styles.loading}>
                      <Loader className={styles.spinner} size={32} />
                      <p>Reading archive...</p>
                    </div>
                  ) : (
                    archiveContents.map((item, index) => (
                      <div key={index} className={styles.archiveItem}>
                        {item.isFolder ? (
                          <Folder size={18} />
                        ) : (
                          <File size={18} />
                        )}
                        <span className={styles.archiveName}>{item.name}</span>
                        {!item.isFolder && (
                          <span className={styles.archiveSize}>
                            {formatFileSize(item.size)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          {!loading && !error && fileType === "epub" && epubBook && (
            <div className={styles.epubPreview}>
              <div ref={epubViewerRef} className={styles.epubViewer}></div>
            </div>
          )}

          {!loading && !error && fileType === "font" && fontData && (
            <div className={styles.fontPreview}>
              <div className={styles.fontHeader}>
                <Type size={32} />
                <div className={styles.fontInfo}>
                  <h3>{fontData.names.fullName?.en || previewFile.name}</h3>
                  <p>{fontData.names.fontFamily?.en || "Unknown Family"}</p>
                  <p className={styles.fontDetails}>
                    {fontData.numGlyphs} glyphs •{" "}
                    {fontData.names.version?.en || "Unknown version"}
                  </p>
                </div>
              </div>
              <div className={styles.fontSamples}>
                <div className={styles.fontSample}>
                  <canvas
                    ref={(canvas) => {
                      if (canvas && fontData) {
                        const ctx = canvas.getContext("2d");
                        canvas.width = canvas.offsetWidth * 2;
                        canvas.height = 200;
                        ctx.scale(2, 2);
                        fontData.draw(ctx, fontPreviewText, 10, 60, 48);
                      }
                    }}
                    style={{ width: "100%", height: "100px" }}
                  />
                </div>
                <div className={styles.fontAlphabet}>
                  <h4>Complete Alphabet</h4>
                  <canvas
                    ref={(canvas) => {
                      if (canvas && fontData) {
                        const ctx = canvas.getContext("2d");
                        canvas.width = canvas.offsetWidth * 2;
                        canvas.height = 300;
                        ctx.scale(2, 2);
                        const alphabet =
                          "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789";
                        const lines = alphabet.split("\n");
                        lines.forEach((line, i) => {
                          fontData.draw(ctx, line, 10, 40 + i * 50, 32);
                        });
                      }
                    }}
                    style={{ width: "100%", height: "150px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {!loading && !error && fileType === "3d" && fileUrl && (
            <div className={styles.modelPreview}>
              <Suspense
                fallback={
                  <div className={styles.loading}>
                    <Loader className={styles.spinner} size={40} />
                    <p>Loading 3D model...</p>
                  </div>
                }
              >
                <Model3D url={fileUrl} fileType={previewFile.name} />
              </Suspense>
            </div>
          )}

          {!loading &&
            !error &&
            fileType === "subtitle" &&
            subtitleContent.length > 0 && (
              <div className={styles.subtitlePreview}>
                <div className={styles.subtitleHeader}>
                  <FileText size={24} />
                  <h3>Subtitles ({subtitleContent.length} entries)</h3>
                </div>
                <div className={styles.subtitleList}>
                  {subtitleContent.map((sub, index) => (
                    <div key={index} className={styles.subtitleItem}>
                      <span className={styles.subtitleTime}>
                        {sub.start} → {sub.end}
                      </span>
                      <p className={styles.subtitleText}>{sub.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {!loading && !error && fileType === "diff" && fileContent && (
            <div className={styles.diffPreview}>
              <SyntaxHighlighter
                language="diff"
                style={vscDarkPlus}
                showLineNumbers={true}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.9rem",
                  maxHeight: "100%",
                  overflow: "auto",
                }}
              >
                {fileContent}
              </SyntaxHighlighter>
            </div>
          )}

          {!loading && !error && fileType === "powerpoint" && fileUrl && (
            <div className={styles.powerpointPreview}>
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                  fileUrl
                )}`}
                className={styles.officeIframe}
                title={previewFile.name}
              >
                Your browser does not support iframes.
              </iframe>
            </div>
          )}

          {!loading && !error && fileType === "google-viewer" && fileUrl && (
            <div className={styles.googleViewerPreview}>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(
                  fileUrl
                )}&embedded=true`}
                className={styles.googleViewerIframe}
                title={previewFile.name}
              >
                Your browser does not support iframes.
              </iframe>
              <div className={styles.googleViewerNote}>
                <p>Preview powered by Google Docs Viewer</p>
                <button
                  onClick={handleDownload}
                  className={styles.downloadButton}
                >
                  <Download size={20} />
                  Download Original File
                </button>
              </div>
            </div>
          )}

          {!loading && !error && fileType === "unknown" && (
            <div className={styles.noPreview}>
              {(() => {
                const IconComponent = getFileTypeIcon(previewFile.name);
                return <IconComponent size={80} className={styles.largeIcon} />;
              })()}
              <h3 className={styles.fileName}>{previewFile.name}</h3>
              <p className={styles.fileDetails}>
                {previewFile.size
                  ? formatFileSize(previewFile.size)
                  : "Unknown size"}
                {previewFile.mimetype && ` • ${previewFile.mimetype}`}
              </p>
              <p className={styles.subtext}>
                This file type cannot be previewed in the browser
              </p>
              <div className={styles.actionButtons}>
                <button
                  onClick={handleDownload}
                  className={styles.primaryButton}
                >
                  <Download size={20} />
                  Download File
                </button>
                {previewFile.shared && previewFile.shared.length > 0 && (
                  <button className={styles.secondaryButton}>
                    <Share2 size={20} />
                    Shared with {previewFile.shared.length}{" "}
                    {previewFile.shared.length === 1 ? "person" : "people"}
                  </button>
                )}
              </div>
              {previewFile.updatedAt && (
                <div className={styles.fileMetadata}>
                  <Info size={16} />
                  <span>
                    Last modified:{" "}
                    {new Date(previewFile.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata Sidebar */}
        {metadataSidebarOpen && (
          <div className={styles.metadataSidebar}>
            <div className={styles.metadataHeader}>
              <h3>File Information</h3>
              <button
                onClick={toggleMetadataSidebar}
                className={styles.iconButton}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.metadataContent}>
              <div className={styles.metadataSection}>
                <div className={styles.metadataLabel}>
                  <FileText size={16} />
                  <span>File Name</span>
                </div>
                <div className={styles.metadataValue}>{previewFile.name}</div>
              </div>

              <div className={styles.metadataSection}>
                <div className={styles.metadataLabel}>
                  <HardDrive size={16} />
                  <span>Size</span>
                </div>
                <div className={styles.metadataValue}>
                  {formatFileSize(previewFile.size)}
                </div>
              </div>

              <div className={styles.metadataSection}>
                <div className={styles.metadataLabel}>
                  <Tag size={16} />
                  <span>Type</span>
                </div>
                <div className={styles.metadataValue}>
                  {getFileTypeCategory(previewFile.name).label}
                  {previewFile.mimetype && (
                    <span className={styles.metadataMimeType}>
                      {previewFile.mimetype}
                    </span>
                  )}
                </div>
              </div>

              {previewFile.createdAt && (
                <div className={styles.metadataSection}>
                  <div className={styles.metadataLabel}>
                    <Calendar size={16} />
                    <span>Created</span>
                  </div>
                  <div className={styles.metadataValue}>
                    {new Date(previewFile.createdAt).toLocaleString()}
                  </div>
                </div>
              )}

              {previewFile.updatedAt && (
                <div className={styles.metadataSection}>
                  <div className={styles.metadataLabel}>
                    <Clock size={16} />
                    <span>Modified</span>
                  </div>
                  <div className={styles.metadataValue}>
                    {new Date(previewFile.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {imageDimensions && (
                <div className={styles.metadataSection}>
                  <div className={styles.metadataLabel}>
                    <FileImage size={16} />
                    <span>Dimensions</span>
                  </div>
                  <div className={styles.metadataValue}>
                    {imageDimensions.width} × {imageDimensions.height} px
                  </div>
                </div>
              )}

              {previewFile.shared && previewFile.shared.length > 0 && (
                <div className={styles.metadataSection}>
                  <div className={styles.metadataLabel}>
                    <Share2 size={16} />
                    <span>Sharing</span>
                  </div>
                  <div className={styles.metadataValue}>
                    Shared with {previewFile.shared.length}{" "}
                    {previewFile.shared.length === 1 ? "person" : "people"}
                  </div>
                </div>
              )}

              {previewFile.owner && (
                <div className={styles.metadataSection}>
                  <div className={styles.metadataLabel}>
                    <User size={16} />
                    <span>Owner</span>
                  </div>
                  <div className={styles.metadataValue}>
                    {previewFile.owner.email || "You"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        {showKeyboardHelp && (
          <div
            className={styles.keyboardHelpOverlay}
            onClick={toggleKeyboardHelp}
          >
            <div
              className={styles.keyboardHelpModal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.keyboardHelpHeader}>
                <h3>Keyboard Shortcuts</h3>
                <button
                  onClick={toggleKeyboardHelp}
                  className={styles.iconButton}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.keyboardHelpContent}>
                <div className={styles.shortcutGroup}>
                  <h4>General</h4>
                  <div className={styles.shortcut}>
                    <kbd>Esc</kbd>
                    <span>Close modal</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>?</kbd>
                    <span>Show/hide this help</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>I</kbd>
                    <span>Toggle file info sidebar</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>D</kbd>
                    <span>Download file</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>F</kbd>
                    <span>Toggle fullscreen</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>Ctrl</kbd> + <kbd>P</kbd>
                    <span>Print (PDF, images, text)</span>
                  </div>
                </div>

                {previewFileList.length > 1 && (
                  <div className={styles.shortcutGroup}>
                    <h4>File Navigation</h4>
                    <div className={styles.shortcut}>
                      <kbd>←</kbd> / <kbd>→</kbd>
                      <span>Previous/Next file</span>
                    </div>
                  </div>
                )}

                <div className={styles.shortcutGroup}>
                  <h4>PDF Navigation</h4>
                  <div className={styles.shortcut}>
                    <kbd>←</kbd> / <kbd>→</kbd>
                    <span>Previous/Next page</span>
                  </div>
                  {previewFileList.length > 1 && (
                    <div className={styles.shortcut}>
                      <kbd>↑</kbd> / <kbd>↓</kbd>
                      <span>Previous/Next file</span>
                    </div>
                  )}
                </div>

                <div className={styles.shortcutGroup}>
                  <h4>Image Controls</h4>
                  <div className={styles.shortcut}>
                    <kbd>+</kbd> / <kbd>-</kbd>
                    <span>Zoom in/out</span>
                  </div>
                  <div className={styles.shortcut}>
                    <kbd>R</kbd>
                    <span>Rotate</span>
                  </div>
                </div>

                <div className={styles.shortcutGroup}>
                  <h4>Excel Navigation</h4>
                  <div className={styles.shortcut}>
                    <kbd>←</kbd> / <kbd>→</kbd>
                    <span>Previous/Next sheet</span>
                  </div>
                  {previewFileList.length > 1 && (
                    <div className={styles.shortcut}>
                      <kbd>↑</kbd> / <kbd>↓</kbd>
                      <span>Previous/Next file</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewModal;
