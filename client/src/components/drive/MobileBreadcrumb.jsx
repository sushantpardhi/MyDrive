import { useState, useRef, useEffect } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import styles from "./MobileBreadcrumb.module.css";

const MobileBreadcrumb = ({ path, navigateTo }) => {
  const scrollRef = useRef(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Check scroll position for fade indicators
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 10);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        scrollElement.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [path]);

  // Don't show on root level - check AFTER hooks
  if (path.length <= 1) {
    return null;
  }

  // Determine if we should collapse (more than 4 items)
  const shouldCollapse = path.length > 4;
  const displayPath = shouldCollapse
    ? [path[0], { id: "ellipsis", name: "..." }, ...path.slice(-2)]
    : path;

  const handleItemClick = (item, displayIndex) => {
    if (item.id === "ellipsis") {
      // Don't navigate on ellipsis
      return;
    }

    // Find actual index in original path
    let actualIndex;
    if (shouldCollapse) {
      if (displayIndex === 0) {
        actualIndex = 0;
      } else if (displayIndex === 1) {
        // Ellipsis - don't do anything
        return;
      } else {
        // Last 2 items
        actualIndex = path.length - (displayPath.length - displayIndex);
      }
    } else {
      actualIndex = displayIndex;
    }

    navigateTo(actualIndex);
  };

  return (
    <div className={styles.mobileBreadcrumbContainer}>
      <div
        className={`${styles.fadeIndicator} ${styles.fadeLeft} ${
          showLeftFade ? styles.visible : ""
        }`}
      />
      <div
        ref={scrollRef}
        className={styles.mobileBreadcrumb}
        aria-label="Breadcrumb navigation"
      >
        {displayPath.map((p, i) => {
          // Create unique key that includes position to avoid React reconciliation issues
          const itemKey = p.id === "ellipsis" ? `ellipsis-${path.length}` : p.id;
          
          return (
            <span
              key={itemKey}
              className={`${styles.breadcrumbItem} ${styles[`item-${i}`]}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
            {i < displayPath.length - 1 ? (
              <>
                <button
                  onClick={() => handleItemClick(p, i)}
                  className={`${styles.mobileBreadcrumbLink} ${
                    p.id === "ellipsis" ? styles.ellipsis : ""
                  }`}
                  title={p.name}
                  disabled={p.id === "ellipsis"}
                  aria-label={`Navigate to ${p.name}`}
                >
                  {p.id === "ellipsis" ? (
                    <MoreHorizontal size={16} className={styles.ellipsisIcon} />
                  ) : (
                    <span className={styles.linkText}>{p.name}</span>
                  )}
                </button>
                <ChevronRight
                  size={14}
                  className={styles.mobileBreadcrumbSeparator}
                />
              </>
            ) : (
              <span className={styles.mobileBreadcrumbCurrent} title={p.name}>
                <span className={styles.currentGradient} />
                <span className={styles.currentText}>{p.name}</span>
              </span>
            )}
            </span>
          );
        })}
      </div>
      <div
        className={`${styles.fadeIndicator} ${styles.fadeRight} ${
          showRightFade ? styles.visible : ""
        }`}
      />
    </div>
  );
};

export default MobileBreadcrumb;
