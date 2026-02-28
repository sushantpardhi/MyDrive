import { useState, useEffect, useRef, useCallback } from "react";
import { pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./PDFPreview.module.css";
import api from "../../services/api";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

const PAGE_BUFFER = 4; // Pages before/after current to render
const DEFAULT_SCALE = 1.2;

const PDFPreview = ({ file, onDownload }) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageHeights, setPageHeights] = useState({});
  const [renderedPages, setRenderedPages] = useState(new Set());

  const containerRef = useRef(null);
  const canvasRefs = useRef({});
  const renderTasksRef = useRef({});
  const isNavButtonClickRef = useRef(false); // Track if page change was from button

  // Load PDF document using streaming (range requests)
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the stream URL - PDF.js will use Range requests automatically
        const streamUrl = api.getFileStreamUrl(file._id);

        // PDF.js supports range requests natively when given a URL
        // It will first request the PDF header, then fetch pages on demand
        loadingTask = pdfjs.getDocument({
          url: streamUrl,
          withCredentials: true, // Send auth cookies
          rangeChunkSize: 65536, // 64KB chunks for range requests
          disableAutoFetch: true, // Don't prefetch entire file
          disableStream: false, // Enable streaming
        });

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);

        // Get first page to determine default height
        const firstPage = await doc.getPage(1);
        const viewport = firstPage.getViewport({ scale });
        const defaultHeight = viewport.height;

        // Set estimated heights for all pages
        const heights = {};
        for (let i = 1; i <= doc.numPages; i++) {
          heights[i] = defaultHeight;
        }
        setPageHeights(heights);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF file");
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy();
      }
      // Cancel all pending render tasks
      Object.values(renderTasksRef.current).forEach((task) => {
        if (task && task.cancel) task.cancel();
      });
      renderTasksRef.current = {};
    };
  }, [file._id]);

  // Render a single page to its canvas
  const renderPage = useCallback(
    async (pageNum) => {
      if (!pdfDoc || !canvasRefs.current[pageNum]) return;

      // Cancel any existing render for this page
      if (renderTasksRef.current[pageNum]) {
        renderTasksRef.current[pageNum].cancel();
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[pageNum];
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        renderTasksRef.current[pageNum] = renderTask;

        await renderTask.promise;

        // Update actual height and mark as rendered
        setPageHeights((prev) => ({ ...prev, [pageNum]: viewport.height }));
        setRenderedPages((prev) => new Set(prev).add(pageNum));
      } catch (err) {
        if (err.name !== "RenderingCancelledException") {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    },
    [pdfDoc, scale],
  );

  // Determine which pages should be rendered based on scroll position
  const getVisibleRange = useCallback(
    (page) => {
      const start = Math.max(1, page - PAGE_BUFFER);
      const end = Math.min(numPages, page + PAGE_BUFFER);
      return { start, end };
    },
    [numPages],
  );

  // Calculate current page from scroll position
  const calculateCurrentPageFromScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 1;

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollCenter = scrollTop + containerHeight / 2;

    // Find which page is at the center of the viewport
    const pageElements = container.querySelectorAll("[data-page]");
    let closestPage = 1;
    let closestDistance = Infinity;

    pageElements.forEach((el) => {
      const pageNum = parseInt(el.getAttribute("data-page"), 10);
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const pageCenter =
        rect.top - containerRect.top + container.scrollTop + rect.height / 2;
      const distance = Math.abs(scrollCenter - pageCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNum;
      }
    });

    return closestPage;
  }, []);

  // Handle scroll - calculate current page and trigger rendering
  const handleScroll = useCallback(() => {
    const newPage = calculateCurrentPageFromScroll();
    setCurrentPage((prev) => {
      if (prev !== newPage) {
        return newPage;
      }
      return prev;
    });
  }, [calculateCurrentPageFromScroll]);

  // Render pages in the visible window when currentPage or scale changes
  useEffect(() => {
    if (!pdfDoc || loading) return;

    const { start, end } = getVisibleRange(currentPage);

    for (let i = start; i <= end; i++) {
      renderPage(i);
    }

    // Cleanup canvases outside the window
    Object.keys(canvasRefs.current).forEach((key) => {
      const pageNum = parseInt(key, 10);
      if (pageNum < start || pageNum > end) {
        const canvas = canvasRefs.current[pageNum];
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = 0;
          canvas.height = 0;
        }
        setRenderedPages((prev) => {
          const next = new Set(prev);
          next.delete(pageNum);
          return next;
        });
      }
    });
  }, [currentPage, scale, pdfDoc, loading, getVisibleRange, renderPage]);

  // Scroll to page ONLY when navigating via buttons
  useEffect(() => {
    if (!isNavButtonClickRef.current) return;
    isNavButtonClickRef.current = false;

    if (!containerRef.current) return;
    const pageEl = containerRef.current.querySelector(
      `[data-page="${currentPage}"]`,
    );
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

  // Zoom controls
  const handleZoomIn = () => {
    setRenderedPages(new Set());
    setScale((prev) => Math.min(prev + 0.25, 3));
  };
  const handleZoomOut = () => {
    setRenderedPages(new Set());
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handlePrevPage = () => {
    isNavButtonClickRef.current = true;
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    isNavButtonClickRef.current = true;
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  if (loading) return <PreviewLoading message="Loading PDF..." />;
  if (error)
    return (
      <PreviewError
        error={error}
        onDownload={onDownload}
        fileName={file.name}
      />
    );

  const { start, end } = getVisibleRange(currentPage);

  return (
    <div className={styles.pdfPreview}>
      {/* PDF Controls Bar */}
      <div className={styles.controls}>
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className={styles.controlBtn}
          title="Previous Page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className={styles.pageInfo}>
          Page {currentPage} of {numPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages}
          className={styles.controlBtn}
          title="Next Page"
        >
          <ChevronRight size={18} />
        </button>

        <div className={styles.divider} />

        <button
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className={styles.controlBtn}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <span className={styles.zoomLevel}>{Math.round(scale * 100)}%</span>
        <button
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className={styles.controlBtn}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* PDF Pages Container */}
      <div
        className={styles.pagesContainer}
        ref={containerRef}
        onScroll={handleScroll}
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageNum = i + 1;
          const isInWindow = pageNum >= start && pageNum <= end;
          const height = pageHeights[pageNum] || 800;

          return (
            <div
              key={pageNum}
              className={styles.pageWrapper}
              data-page={pageNum}
              style={{ minHeight: `${height}px` }}
            >
              {isInWindow ? (
                <canvas
                  ref={(el) => {
                    canvasRefs.current[pageNum] = el;
                  }}
                  className={styles.pageCanvas}
                />
              ) : (
                <div
                  className={styles.pagePlaceholder}
                  style={{ height: `${height}px` }}
                >
                  <span>Page {pageNum}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PDFPreview;
