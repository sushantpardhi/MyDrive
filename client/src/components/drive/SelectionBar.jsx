import {
  Download,
  Share2,
  Trash2,
  RotateCcw,
  Copy,
  FolderInput,
} from "lucide-react";
import styles from "./SelectionBar.module.css";

const SelectionBar = ({
  selectedItemsCount,
  type,
  onBulkDownload,
  onBulkShare,
  onBulkDelete,
  onBulkRestore,
  onBulkCopy,
  onBulkMove,
  onClearSelection,
}) => {
  return (
    <div className={styles.selectionActions}>
      <div className={styles.selectionInfo}>
        <span className={styles.selectedCount}>
          {selectedItemsCount} item{selectedItemsCount !== 1 ? "s" : ""}{" "}
          selected
        </span>
        <button
          onClick={onClearSelection}
          className={styles.clearSelectionBtn}
          aria-label="Clear selection"
          title="Clear selection (Esc)"
        >
          ×
        </button>
      </div>
      <div className={styles.selectionActionsGroup}>
        {type !== "trash" && (
          <>
            <button onClick={onBulkDownload} className={styles.actionBtn}>
              <Download size={16} /> <span>Download</span>
            </button>
            <button onClick={onBulkShare} className={styles.actionBtn}>
              <Share2 size={16} /> <span>Share</span>
            </button>
            <button onClick={onBulkCopy} className={styles.actionBtn}>
              <Copy size={16} /> <span>Copy</span>
            </button>
            <button onClick={onBulkMove} className={styles.actionBtn}>
              <FolderInput size={16} /> <span>Move</span>
            </button>
            <button onClick={onBulkDelete} className={styles.actionBtnDanger}>
              <Trash2 size={16} /> <span>Move to Trash</span>
            </button>
          </>
        )}
        {type === "trash" && (
          <>
            <button onClick={onBulkRestore} className={styles.actionBtn}>
              <RotateCcw size={16} /> <span>Restore</span>
            </button>
            <button onClick={onBulkDelete} className={styles.actionBtnDanger}>
              <Trash2 size={16} /> <span>Delete Permanently</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectionBar;
