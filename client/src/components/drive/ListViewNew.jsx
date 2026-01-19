import FolderCardNew from "../files/FolderCardNew";
import FileCardNew from "../files/FileCardNew";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./ListViewNew.module.css";
import { CheckSquare, FolderOpen } from "lucide-react";

const ListViewNew = ({
  folders,
  files,
  onFolderClick,
  onFolderDelete,
  onFolderShare,
  onFolderRestore,
  onFolderRename,
  onFolderCopy,
  onFolderMove,
  onFolderDownload,
  onFolderProperties,
  onFileDownload,
  onFileDelete,
  onFileShare,
  onFileRestore,
  onFileRename,
  onFileCopy,
  onFileMove,
  onFileProperties,
  onToggleSelection,
  onSelectAll,
  type,
  searchQuery = "",
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  draggedItem,
  dropTarget,
}) => {
  const { selectedItems } = useSelectionContext();
  const totalItems = folders.length + files.length;
  const allSelected = selectedItems.size === totalItems && totalItems > 0;
  const isEmpty = totalItems === 0;

  return (
    <div className={styles.container}>
      {/* Folders Section */}
      {folders.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Folders</h3>
          <div className={styles.table}>
            {/* Table Header */}
            <div className={styles.header}>
              <div className={styles.headerCell}>
                <button
                  className={`${styles.selectAll} ${allSelected ? styles.active : ""}`}
                  onClick={onSelectAll}
                  title="Select all"
                  aria-label="Select all items"
                >
                  <CheckSquare size={16} />
                </button>
              </div>
              <div className={`${styles.headerCell} ${styles.nameCell}`}>Name</div>
              <div className={`${styles.headerCell} ${styles.sizeCell}`}>Size</div>
              <div className={`${styles.headerCell} ${styles.dateCell}`}>Modified</div>
              <div className={`${styles.headerCell} ${styles.actionsCell}`}>Actions</div>
            </div>

            {/* Table Body */}
            <div className={styles.body}>
              {folders.map((folder) => (
                <FolderCardNew
                  key={folder._id}
                  folder={folder}
                  onOpen={(e) => onFolderClick(folder, e)}
                  onDelete={() => onFolderDelete(folder._id)}
                  onShare={() => onFolderShare(folder)}
                  onRestore={() => onFolderRestore(folder._id)}
                  onRename={() => onFolderRename(folder)}
                  onCopy={() => onFolderCopy(folder)}
                  onMove={() => onFolderMove(folder)}
                  onDownload={() => onFolderDownload(folder._id, folder.name)}
                  onProperties={() => onFolderProperties(folder)}
                  selected={selectedItems.has(folder._id)}
                  onSelect={() => onToggleSelection(folder._id)}
                  viewType="list"
                  type={type}
                  searchQuery={searchQuery}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  isDragging={draggedItem?._id === folder._id}
                  isDropTarget={dropTarget?._id === folder._id}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Files</h3>
          <div className={styles.table}>
            {/* Table Header */}
            <div className={styles.header}>
              <div className={styles.headerCell}>
                <button
                  className={`${styles.selectAll} ${allSelected ? styles.active : ""}`}
                  onClick={onSelectAll}
                  title="Select all"
                  aria-label="Select all items"
                >
                  <CheckSquare size={16} />
                </button>
              </div>
              <div className={`${styles.headerCell} ${styles.nameCell}`}>Name</div>
              <div className={`${styles.headerCell} ${styles.sizeCell}`}>Size</div>
              <div className={`${styles.headerCell} ${styles.dateCell}`}>Modified</div>
              <div className={`${styles.headerCell} ${styles.actionsCell}`}>Actions</div>
            </div>

            {/* Table Body */}
            <div className={styles.body}>
              {files.map((file) => (
                <FileCardNew
                  key={file._id}
                  file={file}
                  filesList={files}
                  onDownload={() => onFileDownload(file._id, file.name)}
                  onDelete={() => onFileDelete(file._id)}
                  onShare={() => onFileShare(file)}
                  onRestore={() => onFileRestore(file._id)}
                  onRename={() => onFileRename(file)}
                  onCopy={() => onFileCopy(file)}
                  onMove={() => onFileMove(file)}
                  onProperties={() => onFileProperties(file)}
                  selected={selectedItems.has(file._id)}
                  onSelect={() => onToggleSelection(file._id)}
                  viewType="list"
                  type={type}
                  searchQuery={searchQuery}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isDragging={draggedItem?._id === file._id}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <FolderOpen size={64} strokeWidth={1} />
          </div>
          <h3 className={styles.emptyTitle}>No items found</h3>
          <p className={styles.emptyText}>
            This folder is empty. Upload files or create folders to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default ListViewNew;
