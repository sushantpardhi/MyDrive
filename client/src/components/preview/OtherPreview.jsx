import { useState, useEffect, useRef, Suspense } from "react";
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
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Eye,
  Code2,
  ChevronLeft,
  ChevronRight,
  Folder,
  FileText,
} from "lucide-react";
import { parseSubtitles } from "./previewUtils";
import { formatFileSize } from "../../utils/formatters";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./OtherPreview.module.css";
import api from "../../services/api";

// 3D Model sub-component
const Model3D = ({ url, fileType }) => {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ext = fileType.split(".").pop().toLowerCase();
    let loader;

    if (ext === "stl") loader = new STLLoader();
    else if (ext === "obj") loader = new OBJLoader();
    else if (ext === "gltf" || ext === "glb") loader = new GLTFLoader();

    if (loader) {
      loader.load(
        url,
        (result) => {
          if (ext === "gltf" || ext === "glb") setModel(result.scene);
          else if (ext === "stl") {
            const material = new THREE.MeshStandardMaterial({
              color: 0x888888,
            });
            setModel(new THREE.Mesh(result, material));
          } else setModel(result);
        },
        undefined,
        () => setError("Failed to load 3D model"),
      );
    }
  }, [url, fileType]);

  if (error) return <PreviewError error={error} />;
  if (!model) return <PreviewLoading message="Loading 3D model..." />;

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <Stage environment="city" intensity={0.6}>
        <primitive object={model} />
      </Stage>
      <OrbitControls />
    </Canvas>
  );
};

const OtherPreview = ({ file, fileType, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  // SVG state
  const [svgViewMode, setSvgViewMode] = useState("render");
  const [imageDimensions, setImageDimensions] = useState(null);

  // Archive state
  const [archiveContents, setArchiveContents] = useState([]);

  // EPUB state
  const [epubBook, setEpubBook] = useState(null);
  const [epubRendition, setEpubRendition] = useState(null);
  const epubViewerRef = useRef(null);

  // Font state
  const [fontData, setFontData] = useState(null);
  const [fontPreviewText, setFontPreviewText] = useState(
    "The quick brown fox jumps over the lazy dog",
  );

  // JSON state
  const [jsonData, setJsonData] = useState(null);

  // Subtitle state
  const [subtitleContent, setSubtitleContent] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getFilePreview(file._id);
        if (cancelled) return;

        switch (fileType) {
          case "svg": {
            const url = URL.createObjectURL(response.data);
            setFileUrl(url);
            const img = new Image();
            img.onload = () => {
              if (!cancelled)
                setImageDimensions({ width: img.width, height: img.height });
            };
            img.src = url;
            // Also load SVG source for code view
            const text = await response.data.text();
            if (!cancelled) setFileContent(text);
            break;
          }
          case "markdown": {
            const text = await response.data.text();
            if (!cancelled) setFileContent(text);
            break;
          }
          case "json": {
            const text = await response.data.text();
            if (!cancelled) {
              try {
                setJsonData(JSON.parse(text));
              } catch {
                setError("Invalid JSON file");
              }
            }
            break;
          }
          case "archive": {
            const ext = file.name.split(".").pop().toLowerCase();
            if (ext === "zip") {
              const arrayBuffer = await response.data.arrayBuffer();
              if (cancelled) return;
              const zip = await JSZip.loadAsync(arrayBuffer);
              const files = [];
              zip.forEach((relativePath, zipFile) => {
                files.push({
                  name: relativePath,
                  size: zipFile._data ? zipFile._data.uncompressedSize : 0,
                  isFolder: zipFile.dir,
                });
              });
              setArchiveContents(files);
            } else {
              setError("Only ZIP archives can be previewed");
            }
            break;
          }
          case "epub": {
            const arrayBuffer = await response.data.arrayBuffer();
            if (!cancelled) {
              try {
                const book = ePub(arrayBuffer);
                setEpubBook(book);
              } catch {
                setError("Failed to load EPUB");
              }
            }
            break;
          }
          case "font": {
            const arrayBuffer = await response.data.arrayBuffer();
            if (!cancelled) {
              try {
                setFontData(opentype.parse(arrayBuffer));
              } catch {
                setError("Failed to load font");
              }
            }
            break;
          }
          case "3d": {
            const url = URL.createObjectURL(response.data);
            if (!cancelled) setFileUrl(url);
            break;
          }
          case "subtitle": {
            const text = await response.data.text();
            if (!cancelled) {
              setSubtitleContent(
                parseSubtitles(
                  text,
                  file.name.endsWith(".srt") ? "srt" : "vtt",
                ),
              );
            }
            break;
          }
          case "diff": {
            const text = await response.data.text();
            if (!cancelled) setFileContent(text);
            break;
          }
          default:
            setError("Preview not available for this file type");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading file:", err);
          setError("Failed to load file preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [file._id, fileType]);

  // EPUB rendering
  useEffect(() => {
    if (epubBook && epubViewerRef.current) {
      const rendition = epubBook.renderTo(epubViewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "none",
      });
      rendition.display();
      setEpubRendition(rendition);
      return () => rendition?.destroy();
    }
  }, [epubBook]);

  if (loading) return <PreviewLoading message="Loading file..." />;
  if (error) {
    return (
      <PreviewError
        error={error}
        onDownload={onDownload}
        fileName={file.name}
      />
    );
  }

  // === SVG ===
  if (fileType === "svg") {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.svgControls}>
          <button
            className={`${styles.viewBtn} ${svgViewMode === "render" ? styles.active : ""}`}
            onClick={() => setSvgViewMode("render")}
          >
            <Eye size={16} /> Render
          </button>
          <button
            className={`${styles.viewBtn} ${svgViewMode === "code" ? styles.active : ""}`}
            onClick={() => setSvgViewMode("code")}
          >
            <Code2 size={16} /> Code
          </button>
          {imageDimensions && (
            <span className={styles.dims}>
              {imageDimensions.width} × {imageDimensions.height}
            </span>
          )}
        </div>
        {svgViewMode === "render" ? (
          <div className={styles.svgRender}>
            <img src={fileUrl} alt={file.name} className={styles.svgImage} />
          </div>
        ) : (
          <SyntaxHighlighter
            language="xml"
            style={vscDarkPlus}
            showLineNumbers
            customStyle={{
              margin: 0,
              borderRadius: 8,
              fontSize: "13px",
              maxHeight: "calc(100vh - 200px)",
              overflow: "auto",
            }}
          >
            {fileContent || ""}
          </SyntaxHighlighter>
        )}
      </div>
    );
  }

  // === Markdown ===
  if (fileType === "markdown" && fileContent) {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.markdownContent}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // === JSON ===
  if (fileType === "json" && jsonData) {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.jsonContainer}>
          <JsonView
            value={jsonData}
            displayDataTypes={false}
            style={{
              "--w-rjv-background-color": "#1e1e2e",
              "--w-rjv-color": "#cdd6f4",
              "--w-rjv-key-string": "#89b4fa",
              "--w-rjv-info-color": "#585b70",
              "--w-rjv-type-string-color": "#a6e3a1",
              "--w-rjv-type-int-color": "#fab387",
              "--w-rjv-type-float-color": "#fab387",
              "--w-rjv-type-boolean-color": "#f38ba8",
              "--w-rjv-type-null-color": "#6c7086",
              fontSize: "13px",
            }}
          />
        </div>
      </div>
    );
  }

  // === Archive ===
  if (fileType === "archive" && archiveContents.length > 0) {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.archiveList}>
          <div className={styles.archiveHeader}>
            <span>Contents ({archiveContents.length} items)</span>
          </div>
          {archiveContents.map((item, idx) => (
            <div key={idx} className={styles.archiveItem}>
              {item.isFolder ? (
                <Folder size={16} className={styles.archiveFolderIcon} />
              ) : (
                <FileText size={16} className={styles.archiveFileIcon} />
              )}
              <span className={styles.archiveItemName}>{item.name}</span>
              {!item.isFolder && (
                <span className={styles.archiveItemSize}>
                  {formatFileSize(item.size)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === EPUB ===
  if (fileType === "epub") {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.epubControls}>
          <button
            className={styles.controlBtn}
            onClick={() => epubRendition?.prev()}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => epubRendition?.next()}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
        <div ref={epubViewerRef} className={styles.epubViewer} />
      </div>
    );
  }

  // === Font ===
  if (fileType === "font" && fontData) {
    const fontSizes = [14, 18, 24, 36, 48, 72];
    return (
      <div className={styles.otherPreview}>
        <div className={styles.fontPreview}>
          <div className={styles.fontMeta}>
            <h3>{fontData.names?.fontFamily?.en || file.name}</h3>
            <p>{fontData.names?.fontSubfamily?.en || ""}</p>
          </div>
          <input
            type="text"
            className={styles.fontInput}
            value={fontPreviewText}
            onChange={(e) => setFontPreviewText(e.target.value)}
            placeholder="Type preview text..."
          />
          {fontSizes.map((size) => (
            <div key={size} className={styles.fontSample}>
              <span className={styles.fontSizeLabel}>{size}px</span>
              <p
                style={{
                  fontSize: `${size}px`,
                  fontFamily: fontData.names?.fontFamily?.en,
                }}
              >
                {fontPreviewText}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === 3D Model ===
  if (fileType === "3d" && fileUrl) {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.modelContainer}>
          <Suspense fallback={<PreviewLoading message="Loading 3D model..." />}>
            <Model3D url={fileUrl} fileType={file.name} />
          </Suspense>
        </div>
      </div>
    );
  }

  // === Subtitle ===
  if (fileType === "subtitle" && subtitleContent.length > 0) {
    return (
      <div className={styles.otherPreview}>
        <div className={styles.subtitleList}>
          {subtitleContent.map((sub, idx) => (
            <div key={idx} className={styles.subtitleItem}>
              <span className={styles.subtitleTime}>
                {sub.start} → {sub.end}
              </span>
              <p className={styles.subtitleText}>{sub.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === Diff ===
  if (fileType === "diff" && fileContent) {
    return (
      <div className={styles.otherPreview}>
        <SyntaxHighlighter
          language="diff"
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            borderRadius: 8,
            fontSize: "13px",
            maxHeight: "calc(100vh - 200px)",
            overflow: "auto",
          }}
        >
          {fileContent}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <PreviewError
      error="Preview not available"
      onDownload={onDownload}
      fileName={file.name}
    />
  );
};

export default OtherPreview;
