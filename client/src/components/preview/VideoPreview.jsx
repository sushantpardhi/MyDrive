import { useState, useRef, useEffect, useCallback } from "react";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./VideoPreview.module.css";
import api from "../../services/api";

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for mobile streaming

const VideoPreview = ({ file, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buffering, setBuffering] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const fetchControllerRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch an authenticated stream URL (token embedded in URL for browser compat)
  useEffect(() => {
    let cancelled = false;
    setStreamUrl(null);
    setLoading(true);
    setError(null);
    api.getAuthenticatedStreamUrl(file._id).then((url) => {
      if (!cancelled) setStreamUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [file._id]);

  // Mobile chunked loading via MediaSource API
  const startChunkedStream = useCallback(async () => {
    if (!streamUrl || !videoRef.current) return;

    // Check MediaSource support
    if (!("MediaSource" in window)) {
      // Fallback: use direct src for browsers without MediaSource
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    // MediaSource only works well with mp4/webm
    const mimeMap = {
      mp4: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      webm: 'video/webm; codecs="vp8, vorbis"',
    };
    const mimeType = mimeMap[ext];

    if (!mimeType || !MediaSource.isTypeSupported(mimeType)) {
      // Unsupported format for MediaSource, fallback to native
      return;
    }

    try {
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      const objectUrl = URL.createObjectURL(mediaSource);
      videoRef.current.src = objectUrl;

      mediaSource.addEventListener("sourceopen", async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
          sourceBufferRef.current = sourceBuffer;

          const controller = new AbortController();
          fetchControllerRef.current = controller;

          const response = await fetch(streamUrl, {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const reader = response.body.getReader();
          let done = false;

          const appendBuffer = (chunk) => {
            return new Promise((resolve, reject) => {
              if (sourceBuffer.updating) {
                sourceBuffer.addEventListener("updateend", () => {
                  try {
                    sourceBuffer.appendBuffer(chunk);
                    sourceBuffer.addEventListener("updateend", resolve, {
                      once: true,
                    });
                  } catch (e) {
                    reject(e);
                  }
                }, { once: true });
              } else {
                try {
                  sourceBuffer.appendBuffer(chunk);
                  sourceBuffer.addEventListener("updateend", resolve, {
                    once: true,
                  });
                } catch (e) {
                  reject(e);
                }
              }
            });
          };

          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value && mediaSource.readyState === "open") {
              await appendBuffer(value);
              setLoading(false);
            }
          }

          if (mediaSource.readyState === "open") {
            mediaSource.endOfStream();
          }
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Chunked video loading error:", err);
            // Fallback to direct src on error
            if (videoRef.current && streamUrl) {
              videoRef.current.src = streamUrl;
            }
          }
        }
      });
    } catch (err) {
      console.error("MediaSource setup error:", err);
      // Fallback to direct src
      if (videoRef.current && streamUrl) {
        videoRef.current.src = streamUrl;
      }
    }
  }, [streamUrl, file.name]);

  // Setup video source based on device type
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    if (isMobile) {
      // Try chunked loading on mobile
      startChunkedStream().then((usedChunked) => {
        // If startChunkedStream returned without setting src (unsupported),
        // the video element will still not have a src, so set it directly
        if (videoRef.current && !videoRef.current.src) {
          videoRef.current.src = streamUrl;
        }
      });
    }
    // Desktop uses <source> element set in JSX

    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [streamUrl, isMobile, startChunkedStream]);

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
        playsInline
        preload="metadata"
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onError={handleError}
        style={{ display: loading || !streamUrl ? "none" : "block" }}
      >
        {/* On desktop, use source element for native streaming */}
        {!isMobile && streamUrl && <source src={streamUrl} />}
        Your browser does not support video playback.
      </video>
    </div>
  );
};

export default VideoPreview;
