import { FolderPlus } from "lucide-react";
import GridView from "./GridView";
import ListView from "./ListView";
import LoadingSpinner from "../common/LoadingSpinner";
import styles from "./DriveContent.module.css";
import selectionStyles from "./SelectionBox.module.css";

const DriveContent = ({
  loading,
  loadingMore,
  isSearching,
  folders,
  files,
  viewMode,
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
  driveViewRef,
  searchQuery = "",
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  draggedItem,
  dropTarget,
  isSelecting = false,
  selectionBox = { left: 0, top: 0, width: 0, height: 0 },
  onDragSelectMouseDown,
  onDragSelectMouseMove,
  onDragSelectMouseLeave,
}) => {
  if (loading || isSearching) {
    return (
      <div className={styles.driveView} ref={driveViewRef}>
        <LoadingSpinner
          size="large"
          message={isSearching ? "Searching..." : "Loading files..."}
        />
      </div>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className={styles.driveView} ref={driveViewRef}>
        <div className={styles.emptyFolder}>
          <div className={styles.emptyContent}>
            <FolderPlus size={64} strokeWidth={1} />
            <h3>This folder is empty</h3>
            <p>Drag and drop files here or use the upload button above</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.driveView} ${selectionStyles.container} ${
        isSelecting ? selectionStyles.selecting : ""
      }`}
      ref={driveViewRef}
      onMouseDown={onDragSelectMouseDown}
      onMouseMove={onDragSelectMouseMove}
      onMouseLeave={onDragSelectMouseLeave}
    >
      {viewMode === "grid" ? (
        <GridView
          folders={folders}
          files={files}
          onFolderClick={onFolderClick}
          onFolderDelete={onFolderDelete}
          onFolderShare={onFolderShare}
          onFolderRestore={onFolderRestore}
          onFolderRename={onFolderRename}
          onFolderCopy={onFolderCopy}
          onFolderMove={onFolderMove}
          onFolderDownload={onFolderDownload}
          onFolderProperties={onFolderProperties}
          onFileDownload={onFileDownload}
          onFileDelete={onFileDelete}
          onFileShare={onFileShare}
          onFileRestore={onFileRestore}
          onFileRename={onFileRename}
          onFileCopy={onFileCopy}
          onFileMove={onFileMove}
          onFileProperties={onFileProperties}
          onToggleSelection={onToggleSelection}
          type={type}
          searchQuery={searchQuery}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
        />
      ) : (
        <ListView
          folders={folders}
          files={files}
          onFolderClick={onFolderClick}
          onFolderDelete={onFolderDelete}
          onFolderShare={onFolderShare}
          onFolderRestore={onFolderRestore}
          onFolderRename={onFolderRename}
          onFolderCopy={onFolderCopy}
          onFolderMove={onFolderMove}
          onFolderDownload={onFolderDownload}
          onFolderProperties={onFolderProperties}
          onFileDownload={onFileDownload}
          onFileDelete={onFileDelete}
          onFileShare={onFileShare}
          onFileRestore={onFileRestore}
          onFileRename={onFileRename}
          onFileCopy={onFileCopy}
          onFileMove={onFileMove}
          onFileProperties={onFileProperties}
          onToggleSelection={onToggleSelection}
          onSelectAll={onSelectAll}
          type={type}
          searchQuery={searchQuery}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
        />
      )}

      {loadingMore && (
        <div className={styles.loadingMore}>
          <LoadingSpinner size="small" message="Loading more items..." />
        </div>
      )}

      {/* Selection box for drag select */}
      {isSelecting && (
        <div
          className={selectionStyles.selectionBox}
          style={{
            left: `${selectionBox.left}px`,
            top: `${selectionBox.top}px`,
            width: `${selectionBox.width}px`,
            height: `${selectionBox.height}px`,
          }}
        />
      )}
    </div>
  );
};

export default DriveContent;
