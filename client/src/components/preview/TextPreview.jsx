import { useState, useEffect, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { List } from "react-window";
import { getLanguage } from "./previewUtils";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./TextPreview.module.css";
import api from "../../services/api";

const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB
const LINE_HEIGHT = 20;
const VISIBLE_LINES = 40;

const TextPreview = ({ file, onDownload }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const language = getLanguage(file.name);

  useEffect(() => {
    let cancelled = false;

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getFilePreview(file._id);
        if (cancelled) return;

        const text = await response.data.text();
        if (cancelled) return;

        setContent(text);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading text file:", err);
        setError("Failed to load file content");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
    };
  }, [file._id]);

  const lines = useMemo(() => {
    if (!content) return [];
    return content.split("\n");
  }, [content]);

  const isLargeFile = content && content.length > LARGE_FILE_THRESHOLD;

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
  if (!content) return null;

  // Virtualized rendering for large files
  if (isLargeFile) {
    const Row = ({ index, style }) => (
      <div style={style} className={styles.virtualLine}>
        <span className={styles.lineNumber}>{index + 1}</span>
        <span className={styles.lineContent}>{lines[index]}</span>
      </div>
    );

    return (
      <div className={styles.textPreview}>
        <div className={styles.fileInfo}>
          <span className={styles.lineCount}>{lines.length} lines</span>
          <span className={styles.fileSizeInfo}>
            {(content.length / 1024).toFixed(1)} KB
          </span>
          <span className={styles.virtualizedBadge}>Virtualized</span>
        </div>
        <div className={styles.virtualContainer}>
          <List
            height={VISIBLE_LINES * LINE_HEIGHT}
            itemCount={lines.length}
            itemSize={LINE_HEIGHT}
            width="100%"
            className={styles.virtualList}
          >
            {Row}
          </List>
        </div>
      </div>
    );
  }

  // Normal rendering for small files
  return (
    <div className={styles.textPreview}>
      <div className={styles.fileInfo}>
        <span className={styles.lineCount}>{lines.length} lines</span>
        <span className={styles.fileSizeInfo}>
          {(content.length / 1024).toFixed(1)} KB
        </span>
      </div>
      <div className={styles.syntaxContainer}>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            borderRadius: "0 0 8px 8px",
            fontSize: "13px",
            maxHeight: "calc(100vh - 200px)",
            overflow: "auto",
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default TextPreview;
