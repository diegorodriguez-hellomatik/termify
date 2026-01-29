'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from '@/lib/terminal-themes';

type Theme = 'light' | 'dark';
export type ViewMode = 'grid' | 'compact' | 'list';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  terminalTheme: string;
  setTerminalTheme: (themeId: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [terminalTheme, setTerminalThemeState] = useState<string>(DEFAULT_DARK_THEME);
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const initialTheme = getInitialTheme();
    const initialTerminalTheme = getInitialTerminalTheme(initialTheme === 'dark');
    const initialViewMode = getInitialViewMode();

    setThemeState(initialTheme);
    setTerminalThemeState(initialTerminalTheme);
    setViewModeState(initialViewMode);
    applyTheme(initialTheme);
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
