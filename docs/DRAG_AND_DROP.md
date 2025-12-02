# Drag and Drop Implementation

## Overview

MyDrive now includes comprehensive drag and drop functionality that allows users to move files and folders by dragging them onto target folders. The implementation includes visual feedback, validation, and error handling.

## Features

### Core Functionality

- **Drag files into folders**: Drag any file and drop it into a folder to move it
- **Drag folders into folders**: Move folders into other folders (with circular dependency prevention)
- **Visual feedback**: Clear visual indicators when dragging and when hovering over drop targets
- **Multi-item support**: Infrastructure ready for dragging multiple selected items
- **Validation**: Prevents invalid operations (e.g., moving folder into itself, moving from trash)

### Visual Feedback

#### Dragged Item

- Opacity reduced to 50%
- Slight scale-down effect (0.95x)
- Blur effect applied
- Cursor changes to "grabbing"

#### Drop Target (Folders)

- Highlighted with accent color background
- Dashed border animation
- Pulsing box-shadow effect
- Folder icon bounces to indicate it's ready to receive
- On mobile: Simplified feedback without animations

### Validation Rules

The drag and drop system validates operations to prevent:

1. **Moving items from trash** - Items must be restored first
2. **Moving to trash folders** - Cannot drop into trash folders
3. **Folder into itself** - Cannot drop a folder into itself
4. **Folder into its child** - Prevents circular dependencies
5. **Items already in target** - Skips if items are already in the destination folder

## Implementation Details

### Custom Hook: `useDragAndDrop`

Located at: `client/src/hooks/useDragAndDrop.js`

**Key Methods:**

- `handleDragStart(item, itemType, event)` - Initiates drag operation
- `handleDragOver(targetFolder, event)` - Allows drop on valid targets
- `handleDragEnter(targetFolder, event)` - Highlights drop target
- `handleDragLeave(event)` - Removes highlight from drop target
- `handleDrop(targetFolder, event)` - Executes the move operation
- `handleDragEnd(event)` - Cleans up after drag completes
- `validateDrop(draggedItems, targetFolder)` - Validates if drop is allowed

**State Management:**

- `isDragging` - Boolean indicating if drag is in progress
- `draggedItem` - The item currently being dragged
- `draggedItems` - Array of items being dragged (for multi-select)
- `dropTarget` - The folder currently being hovered over

**Logging:**
Comprehensive logging at all stages:

- Drag start/end events
- Drop validation results
- Move operation success/failure
- Error messages with context

### Component Updates

#### FileCard.jsx

- Added `draggable={type !== "trash"}` attribute
- Added `onDragStart` and `onDragEnd` handlers
- Added `isDragging` prop for styling
- Files can be dragged but not dropped onto

#### FolderCard.jsx

- Added `draggable={type !== "trash"}` attribute
- Added full drag and drop event handlers:
  - `onDragStart` / `onDragEnd` - For dragging the folder
  - `onDragOver` / `onDragEnter` / `onDragLeave` / `onDrop` - For drop zone
- Added `isDragging` and `isDropTarget` props for styling
- Folders can both be dragged AND serve as drop targets

#### DriveView.jsx

- Imports and initializes `useDragAndDrop` hook
- Passes drag handlers to DriveContent component
- Manages drag state (draggedItem, dropTarget)

#### DriveContent.jsx, GridView.jsx, ListView.jsx

- Pass drag and drop props through component hierarchy
- Forward handlers to FileCard and FolderCard components

### CSS Styling

#### FileCard.module.css

```css
.fileCard.dragging {
  opacity: 0.5;
  cursor: grabbing;
  transform: scale(0.95);
  filter: blur(1px);
}

.fileCard[draggable="true"] {
  cursor: grab;
}
```

#### FolderCard.module.css

```css
.folderCard.dragging {
  opacity: 0.5;
  cursor: grabbing;
  transform: scale(0.95);
  filter: blur(1px);
}

.folderCard.dropTarget {
  background: var(--accent-bg-light);
  border-color: var(--accent-primary);
  border-width: 2px;
  border-style: dashed;
  box-shadow: 0 0 0 4px var(--accent-border), var(--shadow-lg);
  animation: dropPulse 1s ease-in-out infinite;
}

.folderCard.dropTarget .folderIcon {
  color: var(--accent-primary);
  animation: iconBounce 0.6s ease-in-out infinite;
}
```

**Animations:**

- `dropPulse` - Subtle scale and box-shadow pulsing for drop targets
- `iconBounce` - Folder icon bounces when it's a valid drop target
- Mobile: Animations disabled for better performance

### Backend Integration

The drag and drop feature uses existing backend endpoints:

**File Move:**

```
PUT /api/files/:id/move
Body: { parent: folderId }
```

**Folder Move:**

```
PUT /api/folders/:id/move
Body: { parent: folderId }
```

Both endpoints in `server/routes/files.js` and `server/routes/folders.js` handle:

- Permission validation (owner check)
- Circular dependency prevention (for folders)
- Updating parent references
- Logging operations

## User Experience

### How to Use

1. **Single Item Move:**

   - Click and hold on a file or folder
   - Drag it over a folder (folder will highlight)
   - Release to move the item into that folder

2. **Visual Feedback:**

   - **While dragging:** Item becomes translucent and slightly smaller
   - **Over valid target:** Folder highlights with blue border and pulsing effect
   - **Invalid target:** No highlighting (e.g., dragging folder onto itself)

3. **Success/Error Messages:**
   - Success: "Successfully moved 1 item to FolderName"
   - Error: Specific message explaining why the operation failed

### Limitations

**Current Version:**

- Multi-select drag is implemented in the hook but not yet wired to UI
- Cannot drag to root folder (must use existing "Move" dialog for that)
- Trash items must be restored before moving
- Cannot create folders by dragging to empty space

**Future Enhancements:**

- Drag multiple selected items simultaneously
- Drop zone on breadcrumb folders for quick navigation
- Drop zone for root/"My Drive" area
- Drag to upload files from desktop
- Undo/redo for move operations

## Browser Compatibility

The implementation uses the HTML5 Drag and Drop API, which is supported in:

- ✅ Chrome/Edge 4+
- ✅ Firefox 3.5+
- ✅ Safari 3.1+
- ✅ Opera 12+

**Mobile Support:**

- Native drag and drop is limited on touch devices
- Disabled on trash items automatically
- Simplified animations on mobile for performance

## Performance Considerations

1. **No Performance Impact When Not Dragging:**

   - Event listeners only active during drag operations
   - No continuous state polling

2. **Efficient State Updates:**

   - Uses `dragCounter` ref to handle nested drag enter/leave events
   - Only updates drop target on actual changes

3. **Optimized API Calls:**

   - Single API call per moved item
   - Folder contents reload only after successful move

4. **CSS Animations:**
   - Hardware-accelerated transforms
   - Disabled on mobile to save battery

## Testing Checklist

- [ ] Drag file into folder in grid view
- [ ] Drag file into folder in list view
- [ ] Drag folder into folder
- [ ] Try to drag folder into itself (should fail with message)
- [ ] Try to drag from trash (should fail with message)
- [ ] Try to drag folder into its child (should fail with message)
- [ ] Verify success toast message appears
- [ ] Verify folder contents refresh after move
- [ ] Check browser console for drag/drop logs
- [ ] Test on mobile (gestures should work, animations simplified)

## Troubleshooting

### Items Won't Drag

- Check if item is in trash (trash items aren't draggable)
- Verify `draggable` attribute is set correctly
- Check browser console for errors

### Drop Not Working

- Verify target is a folder, not a file
- Check validation rules (folder into itself, etc.)
- Look for error messages in toast notifications

### Visual Feedback Not Showing

- Verify CSS classes are being applied (`.dragging`, `.dropTarget`)
- Check if theme variables are defined
- Inspect element to see applied styles

### Console Errors

All drag and drop operations are logged:

```javascript
logger.info("Drag started", { itemId, itemName, itemType });
logger.info("Drop completed successfully", { itemCount, targetFolder });
logger.error("Drop failed", { error, items, targetFolder });
```

## Code Maintenance

### Adding New Validation Rules

Edit `validateDrop` function in `useDragAndDrop.js`:

```javascript
const validateDrop = useCallback((draggedItemsArray, targetFolder) => {
  // Add your validation here
  if (customCondition) {
    return {
      valid: false,
      reason: "Custom error message",
    };
  }
  return { valid: true };
}, []);
```

### Extending to Other Components

To add drag and drop to other views:

1. Import and initialize `useDragAndDrop` hook
2. Pass handlers to child components
3. Add `draggable` attribute and event handlers
4. Add CSS classes for visual feedback

### Logging

All drag and drop operations use the centralized logger:

- `logger.info()` for successful operations
- `logger.warn()` for validation failures
- `logger.error()` for system errors
- `logger.debug()` for detailed state tracking

## Summary

The drag and drop implementation provides an intuitive way to organize files and folders in MyDrive. It's built with:

- ✅ Native HTML5 APIs for broad compatibility
- ✅ Comprehensive validation to prevent errors
- ✅ Clear visual feedback for better UX
- ✅ Extensive logging for debugging
- ✅ Mobile-responsive design
- ✅ Follows existing MyDrive architecture patterns

The feature integrates seamlessly with the existing file operations system and uses the same backend endpoints as the "Move" dialog, ensuring consistency across the application.
