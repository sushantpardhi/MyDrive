import FolderCardNew from "../files/FolderCardNew";
import FileCardNew from "../files/FileCardNew";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./GridViewNew.module.css";
import { FolderOpen } from "lucide-react";

const GridViewNew = ({
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
  onFileLock,
  onFolderLock,
  onToggleSelection,
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
  const allItems = [...folders, ...files];
  const isEmpty = allItems.length === 0;

  return (
    <div className={styles.container}>
      {/* Folders Section */}
      {folders.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Folders</h3>
          <div className={styles.grid}>
            {folders.map((folder, index) => (
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
                onLock={() => onFolderLock(folder)}
                selected={selectedItems.has(folder._id)}
                onSelect={(e) => onToggleSelection(folder._id, e)}
                viewType="grid"
                type={type}
                searchQuery={searchQuery}
                style={{ "--item-index": index }}
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
        </section>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Files</h3>
          <div className={styles.grid}>
            {files.map((file, index) => (
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
                onLock={() => onFileLock(file)}
                selected={selectedItems.has(file._id)}
                onSelect={(e) => onToggleSelection(file._id, e)}
                viewType="grid"
                type={type}
                searchQuery={searchQuery}
                style={{ "--item-index": folders.length + index }}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggedItem?._id === file._id}
              />
            ))}
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

export default GridViewNew;
