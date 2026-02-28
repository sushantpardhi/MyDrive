import { useState, useEffect, useCallback, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2 } from "lucide-react";
import ProgressiveImage from "../common/ProgressiveImage";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./ImagePreview.module.css";
import api from "../../services/api";

const ImagePreview = ({ file, onDownload }) => {
  const [blurUrl, setBlurUrl] = useState(null);
  const [lowQualityUrl, setLowQualityUrl] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [fitMode, setFitMode] = useState("fit"); // "fit" or "actual"
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setBlurUrl(null);
    setLowQualityUrl(null);
    setOriginalUrl(null);
    setZoom(100);
    setRotation(0);
    setPan({ x: 0, y: 0 });

    // Load blur (smallest, fastest)
    api
      .getFileBlur(file._id)
      .then((res) => {
        if (!cancelled) {
          setBlurUrl(URL.createObjectURL(res.data));
          setLoading(false);
        }
      })
      .catch(() => {});

    // Load low-quality
    api
      .getFileLowQuality(file._id)
      .then((res) => {
        if (!cancelled) {
          setLowQualityUrl(URL.createObjectURL(res.data));
          setLoading(false);
        }
      })
      .catch(() => {});

    // Load original
    api
      .getFilePreview(file._id)
      .then((res) => {
        if (!cancelled) {
          const url = URL.createObjectURL(res.data);
          setOriginalUrl(url);
          setLoading(false);

          // Get dimensions
          const img = new Image();
          img.onload = () => {
            if (!cancelled) {
              setImageDimensions({ width: img.width, height: img.height });
            }
          };
          img.onerror = () => {
            if (!cancelled) setError("Failed to load image");
          };
          img.src = url;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load image");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (blurUrl) URL.revokeObjectURL(blurUrl);
      if (lowQualityUrl) URL.revokeObjectURL(lowQualityUrl);
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [file._id]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };
  const toggleFitMode = () => {
    if (fitMode === "fit") {
      setFitMode("actual");
      setZoom(100);
    } else {
      setFitMode("fit");
      setZoom(100);
    }
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = useCallback(
    (e) => {
      if (zoom > 100) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (loading && !blurUrl && !lowQualityUrl) {
    return <PreviewLoading message="Loading image..." />;
  }
  if (error) {
    return (
      <PreviewError
        error={error}
        onDownload={onDownload}
        fileName={file.name}
      />
    );
  }

  const hasProgressiveImage = blurUrl || lowQualityUrl || originalUrl;

  return (
    <div className={styles.imagePreview}>
      {/* Controls */}
      <div className={styles.controls}>
        <button
          onClick={handleZoomOut}
          className={styles.controlBtn}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <span className={styles.zoomLevel}>{zoom}%</span>
        <button
          onClick={handleZoomIn}
          className={styles.controlBtn}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={handleRotate}
          className={styles.controlBtn}
          title="Rotate"
        >
          <RotateCw size={18} />
        </button>
        <button
          onClick={toggleFitMode}
          className={styles.controlBtn}
          title={fitMode === "fit" ? "Actual Size" : "Fit to Screen"}
        >
          {fitMode === "fit" ? (
            <Maximize2 size={18} />
          ) : (
            <Minimize2 size={18} />
          )}
        </button>
        <button onClick={handleReset} className={styles.resetBtn}>
          Reset
        </button>
        {imageDimensions && (
          <span className={styles.dimensions}>
            {imageDimensions.width} × {imageDimensions.height}
          </span>
        )}
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className={styles.imageContainer}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: zoom > 100 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        {hasProgressiveImage ? (
          <div
            className={styles.imageWrapper}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: isDragging ? "none" : "transform 0.2s ease",
            }}
          >
            <ProgressiveImage
              fileId={file._id}
              alt={file.name}
              className={styles.progressiveContainer}
              imgClassName={styles.previewImage}
              mode="progressive"
              blurUrl={blurUrl}
              lowQualityUrl={lowQualityUrl}
              originalUrl={originalUrl}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImagePreview;
