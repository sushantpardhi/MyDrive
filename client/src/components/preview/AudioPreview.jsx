import { useState, useEffect, useRef } from "react";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./AudioPreview.module.css";
import api from "../../services/api";

const AudioPreview = ({ file, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);

  const streamUrl = api.getFileStreamUrl(file._id);

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [file._id]);

  // Waveform visualization
  useEffect(() => {
    if (!audioRef.current || loading) return;

    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audioRef.current);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyserRef.current = analyser;

      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        analyser.getByteFrequencyData(dataArray);

        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;

          const gradient = ctx.createLinearGradient(
            0,
            height,
            0,
            height - barHeight,
          );
          gradient.addColorStop(0, "rgba(99, 102, 241, 0.6)");
          gradient.addColorStop(1, "rgba(139, 92, 246, 0.9)");

          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
          x += barWidth + 1;
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (e) {
      // Audio context not supported — just show the player
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContext) audioContext.close().catch(() => {});
    };
  }, [loading]);

  const handleCanPlay = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError("Failed to load audio file");
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
    <div className={styles.audioPreview}>
      {loading && <PreviewLoading message="Loading audio..." />}
      <div
        className={styles.audioContainer}
        style={{ display: loading ? "none" : "flex" }}
      >
        <div className={styles.visualizer}>
          <canvas ref={canvasRef} className={styles.waveformCanvas} />
        </div>
        <div className={styles.fileIcon}>🎵</div>
        <h3 className={styles.fileName}>{file.name}</h3>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          crossOrigin="use-credentials"
          onCanPlay={handleCanPlay}
          onError={handleError}
          className={styles.audioPlayer}
        >
          <source src={streamUrl} />
          Your browser does not support audio playback.
        </audio>
      </div>
    </div>
  );
};

export default AudioPreview;
