import FolderCard from "../files/FolderCard";
import FileCard from "../files/FileCard";
import { useSelectionContext } from "../../contexts/SelectionContext";
import styles from "./ListView.module.css";
import { CheckSquare } from "lucide-react";

const ListView = ({
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
  onFileDownload,
  onFileDelete,
  onFileShare,
  onFileRestore,
  onFileRename,
  onFileCopy,
  onFileMove,
  onToggleSelection,
  onSelectAll,
  type,
}) => {
  const { selectedItems } = useSelectionContext();
  const totalItems = folders.length + files.length;
  const allSelected = selectedItems.size === totalItems && totalItems > 0;

  return (
    <div className={styles.listView}>
      {/* Table Header */}
      <div className={styles.listHeader}>
        <div className={styles.headerCheckbox}>
          <button
            className={`${styles.selectAllBtn} ${
              allSelected ? styles.active : ""
            }`}
            onClick={onSelectAll}
            title="Select all"
            aria-label="Select all items"
          >
            <CheckSquare size={16} />
          </button>
        </div>
        <div className={styles.headerName}>Name</div>
        <div className={styles.headerSize}>Size</div>
        <div className={styles.headerMeta}>Last modified</div>
        <div className={styles.headerActions}>Actions</div>
      </div>

      {/* Table Body */}
      <div className={styles.listBody}>
        {folders.map((folder) => (
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
            selected={selectedItems.has(folder._id)}
            onSelect={() => onToggleSelection(folder._id)}
            viewType="list"
            type={type}
          />
        ))}
        {files.map((file) => (
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
            selected={selectedItems.has(file._id)}
            onSelect={() => onToggleSelection(file._id)}
            viewType="list"
            type={type}
          />
        ))}
      </div>
    </div>
  );
};

export default ListView;
