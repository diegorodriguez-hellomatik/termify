'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, EyeOff } from 'lucide-react';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useTheme();
  const [isHidden, setIsHidden] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load hidden state from localStorage
  useEffect(() => {
    setMounted(true);
    const hidden = localStorage.getItem('themeToggleHidden') === 'true';
    setIsHidden(hidden);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleHide = () => {
    setIsHidden(true);
    localStorage.setItem('themeToggleHidden', 'true');
    setContextMenu(null);
  };

  const closeContextMenu = () => setContextMenu(null);

  // Don't render button if hidden or not mounted
  if (!mounted || isHidden) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Floating Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        onContextMenu={handleContextMenu}
        className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center w-12 h-12 rounded-full border-0 cursor-pointer shadow-lg transition-all duration-200 hover:scale-110 active:scale-100"
        style={{
          backgroundColor: isDark ? '#333' : '#fff',
          color: isDark ? '#fff' : '#333',
          boxShadow: isDark
            ? '0 4px 12px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.15)',
        }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {/* Context Menu */}
      {contextMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[99998]"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="fixed z-[99999] min-w-[120px] py-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 140),
              top: Math.min(contextMenu.y, window.innerHeight - 50),
            }}
          >
            <button
              onClick={handleHide}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              Hide
            </button>
          </div>
        </>,
        document.body
      )}

      {children}
    </div>
  );
}

// Hook to get theme-aware colors
export function useThemeColors() {
  const { isDark } = useTheme();

  return {
    bg: isDark ? '#0a0a0a' : '#f5f5f5',
    bgCard: isDark ? '#1a1a1a' : '#ffffff',
    bgHover: isDark ? '#252525' : '#f0f0f0',
    text: isDark ? '#ffffff' : '#1a1a1a',
    textMuted: isDark ? '#888888' : '#666666',
    border: isDark ? '#333333' : '#dddddd',
    primary: isDark ? '#60a5fa' : '#2563eb',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
  };
}
