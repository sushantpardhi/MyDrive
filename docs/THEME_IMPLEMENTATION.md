# Theme Implementation Guide

## Overview

A comprehensive theme system using React Context API has been implemented across the entire MyDrive application, supporting both light and dark modes with seamless toggling.

## Implementation Details

### 1. Theme Context (`client/src/contexts/ThemeContext.js`)

- Manages theme state (light/dark)
- Persists theme preference in localStorage
- Automatically applies theme to document root via `data-theme` attribute
- Provides theme control functions

**API:**

```javascript
const { theme, toggleTheme, isDark, isLight, setLightTheme, setDarkTheme } =
  useTheme();
```

### 2. CSS Variables (`client/src/styles/theme.css`)

Complete set of CSS variables for both themes:

- **Light theme** (default): `:root { ... }`
- **Dark theme**: `[data-theme="dark"] { ... }`

Variables include:

- Background colors (bg-primary, bg-secondary, etc.)
- Text colors (text-primary, text-secondary, etc.)
- Border colors
- Accent/status colors
- Component-specific colors (sidebar, header, cards, modals, etc.)
- Shadows and overlays

### 3. Provider Integration (`client/src/App.js`)

ThemeProvider wraps the entire application at the top level:

```javascript
<ThemeProvider>
  <AuthProvider>
    <BrowserRouter>{/* ... routes */}</BrowserRouter>
  </AuthProvider>
</ThemeProvider>
```

### 4. Context Export (`client/src/contexts/index.js`)

Centralized export for easy importing:

```javascript
export { ThemeProvider, useTheme } from "./ThemeContext";
```

## Usage in Components

### Accessing Theme Context

```javascript
import { useTheme } from "../../contexts";

const MyComponent = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? "Switch to Light" : "Switch to Dark"}
    </button>
  );
};
```

### Using CSS Variables in Modules

All existing CSS modules automatically work with themes:

```css
.container {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  transition: background-color var(--transition-normal), color var(--transition-normal);
}
```

## Theme Toggle Locations

### 1. Sidebar (`client/src/components/layout/Sidebar.jsx`)

- Always visible theme toggle button
- Shows icon (Moon/Sun) with text
- Located above storage section
- Accessible from all main views

### 2. User Profile (`client/src/components/auth/UserProfile.jsx`)

- Theme toggle in "Appearance" section
- More prominent with full button styling
- Accessible from profile page

## Components Updated

### Modified Files:

1. **ThemeContext.js** (NEW) - Core theme logic
2. **contexts/index.js** - Added ThemeContext export
3. **App.js** - Integrated ThemeProvider
4. **Sidebar.jsx** - Added theme toggle button
5. **Sidebar.module.css** - Added toggle styles
6. **UserProfile.jsx** - Added appearance section with theme toggle
7. **UserProfile.module.css** - Added theme toggle styles
8. **theme.css** - Added complete dark theme variables

### Auto-Themed Components:

All components using CSS modules automatically support theming:

- Drive views (grid/list)
- File/folder cards
- Headers and navigation
- Modals and dialogs
- Forms and inputs
- Auth pages
- Toast notifications

## Features

✅ Automatic theme persistence via localStorage
✅ Smooth transitions between themes
✅ All CSS variables update instantly
✅ Accessible theme toggles with icons
✅ Dark mode optimized for reduced eye strain
✅ Consistent color system across all components
✅ Mobile-responsive theme controls
✅ No flash of unstyled content on load

## Testing Theme

1. **Navigate to Profile**: Click user avatar → Click profile → See theme toggle in Appearance section
2. **Use Sidebar Toggle**: Open sidebar → Click theme toggle button (Moon/Sun icon)
3. **Verify Persistence**: Refresh page → Theme should persist
4. **Check All Views**: Test drive, shared, trash views → All should respect theme

## CSS Variable Reference

### Most Common Variables:

- `--bg-primary` - Main background
- `--bg-secondary` - Secondary background (slightly different shade)
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text (less prominent)
- `--border-color` - Standard borders
- `--accent-primary` - Primary accent (buttons, links)
- `--card-bg` - Card backgrounds
- `--modal-bg` - Modal backgrounds

### Adding New Components:

Always use CSS variables instead of hardcoded colors:

```css
/* ✅ CORRECT */
.myComponent {
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ❌ AVOID */
.myComponent {
  background: #ffffff;
  color: #000000;
}
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS variables supported in all target browsers
- localStorage for theme persistence
- Graceful fallback to light theme if issues occur

## Future Enhancements

Potential additions:

- System preference detection (prefers-color-scheme)
- Additional theme variants (sepia, high contrast)
- Per-component theme customization
- Theme scheduling (auto dark mode at night)
