'use client';

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Floating Theme Toggle Button */}
      <button
        onClick={toggleTheme}
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
