'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, getTerminalTheme, TerminalTheme } from '@/lib/terminal-themes';

type Theme = 'light' | 'dark';
export type ViewMode = 'grid' | 'compact' | 'list';
export type PanelThemeMode = 'default' | 'terminal';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  terminalTheme: string;
  setTerminalTheme: (themeId: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  panelThemeMode: PanelThemeMode;
  setPanelThemeMode: (mode: PanelThemeMode) => void;
  terminalColors: TerminalTheme['colors'] | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Convert hex to HSL for Tailwind CSS variables
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 0%';

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Lighten or darken a hex color
function adjustColor(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

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

// Apply terminal theme colors as CSS variables
function applyTerminalThemeToPanel(terminalThemeId: string, panelMode: PanelThemeMode) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (panelMode === 'default') {
    // Remove terminal theme variables
    root.removeAttribute('data-terminal-theme');
    root.style.removeProperty('--panel-background');
    root.style.removeProperty('--panel-foreground');
    root.style.removeProperty('--panel-card');
    root.style.removeProperty('--panel-card-foreground');
    root.style.removeProperty('--panel-border');
    root.style.removeProperty('--panel-muted');
    root.style.removeProperty('--panel-muted-foreground');
    root.style.removeProperty('--panel-accent');
    root.style.removeProperty('--panel-primary');
    return;
  }

  const theme = getTerminalTheme(terminalThemeId);
  const colors = theme.colors;

  root.setAttribute('data-terminal-theme', terminalThemeId);

  // Apply terminal colors as CSS variables
  root.style.setProperty('--panel-background', hexToHSL(colors.background));
  root.style.setProperty('--panel-foreground', hexToHSL(colors.foreground));
  root.style.setProperty('--panel-card', hexToHSL(adjustColor(colors.background, theme.isDark ? 10 : -10)));
  root.style.setProperty('--panel-card-foreground', hexToHSL(colors.foreground));
  root.style.setProperty('--panel-border', hexToHSL(adjustColor(colors.background, theme.isDark ? 30 : -30)));
  root.style.setProperty('--panel-muted', hexToHSL(adjustColor(colors.background, theme.isDark ? 20 : -20)));
  root.style.setProperty('--panel-muted-foreground', hexToHSL(colors.brightBlack));
  root.style.setProperty('--panel-accent', hexToHSL(colors.blue));
  root.style.setProperty('--panel-primary', hexToHSL(colors.cyan));
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

// Get initial panel theme mode (SSR-safe)
function getInitialPanelThemeMode(): PanelThemeMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('panelThemeMode') as PanelThemeMode;
    if (saved === 'default' || saved === 'terminal') {
      return saved;
    }
  }
  return 'terminal'; // Default to terminal theme for cohesive look
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [terminalTheme, setTerminalThemeState] = useState<string>(DEFAULT_DARK_THEME);
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [panelThemeMode, setPanelThemeModeState] = useState<PanelThemeMode>('terminal');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const initialTheme = getInitialTheme();
    const initialTerminalTheme = getInitialTerminalTheme(initialTheme === 'dark');
    const initialViewMode = getInitialViewMode();
    const initialPanelThemeMode = getInitialPanelThemeMode();

    setThemeState(initialTheme);
    setTerminalThemeState(initialTerminalTheme);
    setViewModeState(initialViewMode);
    setPanelThemeModeState(initialPanelThemeMode);
    applyTheme(initialTheme);
    applyTerminalThemeToPanel(initialTerminalTheme, initialPanelThemeMode);
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
      applyTerminalThemeToPanel(terminalTheme, panelThemeMode);
    }
  }, [terminalTheme, panelThemeMode, mounted]);

  // Save panel theme mode to localStorage when it changes (after mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('panelThemeMode', panelThemeMode);
      applyTerminalThemeToPanel(terminalTheme, panelThemeMode);
    }
  }, [panelThemeMode, terminalTheme, mounted]);

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

  const setPanelThemeMode = (mode: PanelThemeMode) => {
    setPanelThemeModeState(mode);
  };

  // Get current terminal colors
  const terminalColors = mounted ? getTerminalTheme(terminalTheme).colors : null;

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
        panelThemeMode,
        setPanelThemeMode,
        terminalColors,
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
