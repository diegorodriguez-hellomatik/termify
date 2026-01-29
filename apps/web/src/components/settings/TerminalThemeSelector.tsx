'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Palette, Check, Monitor, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTheme, PanelThemeMode } from '@/context/ThemeContext';
import { TERMINAL_THEMES, THEME_IDS, getTerminalTheme } from '@/lib/terminal-themes';
import { cn } from '@/lib/utils';

interface TerminalThemeSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function TerminalThemeSelector({ className, showLabel = true }: TerminalThemeSelectorProps) {
  const { terminalTheme, setTerminalTheme, isDark, panelThemeMode, setPanelThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTheme = getTerminalTheme(terminalTheme);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
          'hover:bg-muted',
          isOpen
            ? 'border-primary bg-muted'
            : 'border-border bg-card'
        )}
      >
        <div
          className="w-4 h-4 rounded-sm border border-border"
          style={{ backgroundColor: currentTheme.colors.background }}
        />
        {showLabel && (
          <span className="text-sm font-medium">{currentTheme.name}</span>
        )}
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 w-64 rounded-lg border border-border bg-card shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{ right: 0 }}
        >
          <div className="p-2">
            {/* Apply to Panel Toggle */}
            <button
              onClick={() => setPanelThemeMode(panelThemeMode === 'terminal' ? 'default' : 'terminal')}
              className={cn(
                'w-full flex items-center justify-between px-2 py-2 rounded-md transition-colors mb-2',
                'hover:bg-muted text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Monitor size={14} className="text-muted-foreground" />
                <span className="text-sm">Apply to panel</span>
              </div>
              {panelThemeMode === 'terminal' ? (
                <ToggleRight size={20} className="text-primary" />
              ) : (
                <ToggleLeft size={20} className="text-muted-foreground" />
              )}
            </button>

            <div className="flex items-center gap-2 px-2 py-1.5 mb-2 border-t border-b border-border">
              <Palette size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Terminal Theme
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {THEME_IDS.map((themeId) => {
                const theme = TERMINAL_THEMES[themeId];
                const isSelected = terminalTheme === themeId;

                return (
                  <button
                    key={themeId}
                    onClick={() => {
                      setTerminalTheme(themeId);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    {/* Color preview */}
                    <div
                      className="w-8 h-6 rounded border border-border overflow-hidden flex"
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.red }}
                      />
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.green }}
                      />
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.blue }}
                      />
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.yellow }}
                      />
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.magenta }}
                      />
                      <div
                        className="w-1"
                        style={{ backgroundColor: theme.colors.cyan }}
                      />
                    </div>

                    <div className="flex-1 text-left">
                      <span className="text-sm">{theme.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {theme.isDark ? 'Dark' : 'Light'}
                      </span>
                    </div>

                    {isSelected && <Check size={14} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
