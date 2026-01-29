'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Terminal, Clock, Star, ArrowRight, Command, Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

interface TerminalItem {
  id: string;
  name: string;
  status?: string;
  lastActiveAt?: string | null;
  createdAt?: string;
  isFavorite?: boolean;
  categoryName?: string;
  categoryColor?: string;
}

type SplitMode = {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  sourceTerminalId: string;
};

interface QuickSwitcherProps {
  terminals: TerminalItem[];
  onSelect: (terminalId: string, name: string) => void;
  onClose: () => void;
  isDark: boolean;
  mode?: 'open' | SplitMode;
  onCreateNew?: () => void;
}

export function QuickSwitcher({
  terminals,
  onSelect,
  onClose,
  isDark,
  mode = 'open',
  onCreateNew,
}: QuickSwitcherProps) {
  const isSplitMode = typeof mode === 'object' && mode.type === 'split';
  const { tabs, showQuickSwitcher, setShowQuickSwitcher } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and sort terminals
  const filteredTerminals = useMemo(() => {
    let filtered = terminals;

    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = terminals.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.categoryName?.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort: favorites first, then by last active
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      const aTime = a.lastActiveAt || a.createdAt || '';
      const bTime = b.lastActiveAt || b.createdAt || '';
      return bTime.localeCompare(aTime);
    });
  }, [terminals, query]);

  // Check if terminal is already open in a tab
  const isOpen = (terminalId: string) => tabs.some((t) => t.terminalId === terminalId);

  // Focus input on mount
  useEffect(() => {
    if (showQuickSwitcher) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [showQuickSwitcher]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showQuickSwitcher) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredTerminals.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredTerminals.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredTerminals[selectedIndex]) {
            const terminal = filteredTerminals[selectedIndex];
            onSelect(terminal.id, terminal.name);
            setShowQuickSwitcher(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowQuickSwitcher(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickSwitcher, filteredTerminals, selectedIndex, onSelect, setShowQuickSwitcher]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!showQuickSwitcher) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowQuickSwitcher(false)}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-150'
        )}
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        {/* Header */}
        {isSplitMode && (
          <div
            className="px-4 py-2 border-b text-sm font-medium"
            style={{
              borderColor: isDark ? '#333' : '#e0e0e0',
              backgroundColor: isDark ? '#252525' : '#f5f5f5'
            }}
          >
            Split {mode.direction === 'horizontal' ? '→' : '↓'} Select terminal
          </div>
        )}

        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isSplitMode ? "Select terminal to show in split..." : "Search terminals..."}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            autoComplete="off"
          />
          <kbd
            className={cn(
              'px-2 py-0.5 rounded text-xs font-mono',
              isDark ? 'bg-white/10' : 'bg-black/5'
            )}
          >
            esc
          </kbd>
        </div>

        {/* Terminal list */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {filteredTerminals.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Terminal size={32} className="mx-auto mb-2 opacity-50" />
              <p>No terminals found</p>
            </div>
          ) : (
            filteredTerminals.map((terminal, index) => (
              <button
                key={terminal.id}
                onClick={() => {
                  onSelect(terminal.id, terminal.name);
                  setShowQuickSwitcher(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                  index === selectedIndex
                    ? isDark
                      ? 'bg-white/10'
                      : 'bg-black/5'
                    : 'hover:bg-muted/50'
                )}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: terminal.categoryColor
                      ? `${terminal.categoryColor}20`
                      : isDark
                      ? '#333'
                      : '#f0f0f0',
                  }}
                >
                  <Terminal
                    size={16}
                    style={{
                      color: terminal.categoryColor || (isDark ? '#888' : '#666'),
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{terminal.name}</span>
                    {terminal.isFavorite && (
                      <Star size={12} className="text-yellow-500 flex-shrink-0" fill="currentColor" />
                    )}
                    {isOpen(terminal.id) && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? '#333' : '#e0e0e0',
                          color: isDark ? '#888' : '#666',
                        }}
                      >
                        Open
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {terminal.categoryName && (
                      <span>{terminal.categoryName}</span>
                    )}
                    {terminal.lastActiveAt && (
                      <>
                        <Clock size={10} />
                        <span>{formatRelativeTime(terminal.lastActiveAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                {index === selectedIndex && (
                  <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))
          )}

          {/* Create New option for split mode */}
          {isSplitMode && onCreateNew && (
            <button
              onClick={() => {
                onCreateNew();
                setShowQuickSwitcher(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-t',
                'hover:bg-muted/50'
              )}
              style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isDark ? '#333' : '#f0f0f0',
                }}
              >
                <Plus size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">Create New Terminal</span>
                <div className="text-xs text-muted-foreground">
                  Start a new terminal session
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t flex items-center justify-between text-xs text-muted-foreground"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className={cn('px-1.5 py-0.5 rounded', isDark ? 'bg-white/10' : 'bg-black/5')}>
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className={cn('px-1.5 py-0.5 rounded', isDark ? 'bg-white/10' : 'bg-black/5')}>
                Enter
              </kbd>
              Open
            </span>
          </div>
          <span>{filteredTerminals.length} terminals</span>
        </div>
      </div>
    </div>
  );
}
