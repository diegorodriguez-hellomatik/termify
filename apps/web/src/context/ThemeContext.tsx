'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from '@/lib/terminal-themes';

type Theme = 'light' | 'dark';
export type ViewMode = 'grid' | 'compact' | 'list';
export type FontFamily = 'jetbrains' | 'fira' | 'source' | 'ibm' | 'space' | 'inter';
export type FontSize = '13' | '14' | '15' | '16' | '17' | '18';

export const FONT_OPTIONS: { value: FontFamily; label: string; description: string }[] = [
  { value: 'jetbrains', label: 'JetBrains Mono', description: 'Designed for developers' },
  { value: 'fira', label: 'Fira Code', description: 'With programming ligatures' },
  { value: 'source', label: 'Source Code Pro', description: 'Adobe\'s coding font' },
  { value: 'ibm', label: 'IBM Plex Mono', description: 'Clean and professional' },
  { value: 'space', label: 'Space Mono', description: 'Retro terminal style' },
  { value: 'inter', label: 'Inter', description: 'Modern sans-serif' },
];

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: '13', label: 'Extra Small (13px)' },
  { value: '14', label: 'Small (14px)' },
  { value: '15', label: 'Medium (15px)' },
  { value: '16', label: 'Large (16px)' },
  { value: '17', label: 'Extra Large (17px)' },
  { value: '18', label: 'Huge (18px)' },
];

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  terminalTheme: string;
  setTerminalTheme: (themeId: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to apply theme to document
function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Get initial theme (SSR-safe)
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Check system preference
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark'; // default to dark
}

// Get initial terminal theme (SSR-safe)
function getInitialTerminalTheme(isDark: boolean): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('terminalTheme');
    if (saved) {
      return saved;
    }
  }
  return isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}

// Get initial view mode (SSR-safe)
function getInitialViewMode(): ViewMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('viewMode') as ViewMode;
    if (saved === 'grid' || saved === 'compact' || saved === 'list') {
      return saved;
    }
  }
  return 'grid';
}

// Get initial font family (SSR-safe)
function getInitialFontFamily(): FontFamily {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('fontFamily') as FontFamily;
    if (['jetbrains', 'fira', 'source', 'ibm', 'space', 'inter'].includes(saved)) {
      return saved;
    }
  }
  return 'jetbrains';
}

// Get initial font size (SSR-safe)
function getInitialFontSize(): FontSize {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('fontSize') as FontSize;
    if (['13', '14', '15', '16', '17', '18'].includes(saved)) {
      return saved;
    }
  }
  return '16';
}

// Apply font family to document
function applyFontFamily(font: FontFamily) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-font', font);
  }
}

// Apply font size to document
function applyFontSize(size: FontSize) {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--font-size', `${size}px`);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [terminalTheme, setTerminalThemeState] = useState<string>(DEFAULT_DARK_THEME);
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [fontFamily, setFontFamilyState] = useState<FontFamily>('jetbrains');
  const [fontSize, setFontSizeState] = useState<FontSize>('16');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const initialTheme = getInitialTheme();
    const initialTerminalTheme = getInitialTerminalTheme(initialTheme === 'dark');
    const initialViewMode = getInitialViewMode();
    const initialFontFamily = getInitialFontFamily();
    const initialFontSize = getInitialFontSize();

    setThemeState(initialTheme);
    setTerminalThemeState(initialTerminalTheme);
    setViewModeState(initialViewMode);
    setFontFamilyState(initialFontFamily);
    setFontSizeState(initialFontSize);
    applyTheme(initialTheme);
    applyFontFamily(initialFontFamily);
    applyFontSize(initialFontSize);
    setMounted(true);
  }, []);

  // Save theme to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('theme', theme);
      applyTheme(theme);
    }
  }, [theme, mounted]);

  // Save terminal theme to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('terminalTheme', terminalTheme);
    }
  }, [terminalTheme, mounted]);

  // Save view mode to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('viewMode', viewMode);
    }
  }, [viewMode, mounted]);

  // Save font family to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('fontFamily', fontFamily);
      applyFontFamily(fontFamily);
    }
  }, [fontFamily, mounted]);

  // Save font size to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('fontSize', fontSize);
      applyFontSize(fontSize);
    }
  }, [fontSize, mounted]);

  const toggleTheme = () => {
    setThemeState(theme === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setTerminalTheme = (themeId: string) => {
    setTerminalThemeState(themeId);
  };

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
  };

  const setFontFamily = (font: FontFamily) => {
    setFontFamilyState(font);
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
        terminalTheme,
        setTerminalTheme,
        viewMode,
        setViewMode,
        fontFamily,
        setFontFamily,
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
