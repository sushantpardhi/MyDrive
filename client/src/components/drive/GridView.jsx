import FolderCard from "../files/FolderCard";
import FileCard from "../files/FileCard";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./GridView.module.css";

const GridView = ({
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
  // Combine folders and files for unified animation indexing
  const allItems = [...folders, ...files];

  return (
    <div className={styles.gridView}>
      {folders.map((folder, index) => (
        <FolderCard
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
      {files.map((file, index) => (
        <FileCard
          key={file._id}
          file={file}
          onDownload={() => onFileDownload(file._id, file.name)}
          onDelete={() => onFileDelete(file._id)}
          onShare={() => onFileShare(file)}
          onRestore={() => onFileRestore(file._id)}
          onRename={() => onFileRename(file)}
          onCopy={() => onFileCopy(file)}
          onMove={() => onFileMove(file)}
          onProperties={() => onFileProperties(file)}
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
      {allItems.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyContent}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z"
                fill="currentColor"
              />
            </svg>
            <h3>No items found</h3>
            <p>
              This folder is empty. Upload files or create folders to get
              started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridView;
