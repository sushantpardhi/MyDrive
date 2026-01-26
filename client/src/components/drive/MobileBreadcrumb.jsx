import styles from "./MobileBreadcrumb.module.css";

const MobileBreadcrumb = ({ path, navigateTo }) => {
  // Don't show on root level
  if (path.length <= 1) {
    return null;
  }

  return (
    <div className={styles.mobileBreadcrumb}>
      {path.map((p, i) => (
        <span key={p.id} className={styles.breadcrumbItem}>
          {i < path.length - 1 ? (
            <>
              <button
                onClick={() => navigateTo(i)}
                className={styles.mobileBreadcrumbLink}
                title={p.name}
              >
                {p.name}
              </button>
              <span className={styles.mobileBreadcrumbSeparator}>›</span>
            </>
          ) : (
            <span className={styles.mobileBreadcrumbCurrent} title={p.name}>
              {p.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

export default MobileBreadcrumb;
