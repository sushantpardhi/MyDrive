import { useState, useRef, useEffect } from "react";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./VideoPreview.module.css";
import api from "../../services/api";

const VideoPreview = ({ file, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buffering, setBuffering] = useState(false);
  const videoRef = useRef(null);

  // Build streaming URL (browser handles Range requests natively)
  const streamUrl = api.getFileStreamUrl(file._id);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [file._id]);

  const handleCanPlay = () => {
    setLoading(false);
    setBuffering(false);
  };

  const handleWaiting = () => {
    setBuffering(true);
  };

  const handlePlaying = () => {
    setBuffering(false);
  };

  const handleError = () => {
    setError("Failed to load video. The format may not be supported.");
    setLoading(false);
  };

  if (error) {
    return (
      <PreviewError
        error={error}
        onDownload={onDownload}
        fileName={file.name}
      />
    );
  }

  return (
    <div className={styles.videoPreview}>
      {loading && <PreviewLoading message="Loading video..." />}
      {buffering && !loading && (
        <div className={styles.bufferingOverlay}>
          <div className={styles.bufferingSpinner} />
        </div>
      )}
      <video
        ref={videoRef}
        className={styles.videoPlayer}
        controls
        preload="metadata"
        crossOrigin="use-credentials"
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onError={handleError}
        style={{ display: loading ? "none" : "block" }}
      >
        <source src={streamUrl} />
        Your browser does not support video playback.
      </video>
    </div>
  );
};

export default VideoPreview;
