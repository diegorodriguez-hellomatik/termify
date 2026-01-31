'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

// Default shortcuts for standalone use
const DEFAULT_SHORTCUTS = [
  { key: 'n', description: 'Create new terminal', ctrl: true },
  { key: 'f', description: 'Focus search', ctrl: true },
  { key: ',', description: 'Open settings', ctrl: true },
  { key: 'k', description: 'Quick switcher', ctrl: true },
  { key: 'Escape', description: 'Close modals' },
  { key: '?', description: 'Show shortcuts help', shift: true },
];

function formatShortcut(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) {
  const parts: string[] = [];
  if (shortcut.ctrl || shortcut.meta) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}

export interface ShortcutsHelpModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isDark?: boolean;
  // For context-based usage
  useContext?: boolean;
  showHelp?: boolean;
  setShowHelp?: (show: boolean) => void;
}

export function ShortcutsHelpModal({
  isOpen,
  onClose,
  isDark: isDarkProp,
  showHelp: contextShowHelp,
  setShowHelp: contextSetShowHelp,
}: ShortcutsHelpModalProps) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;
  const shortcuts = DEFAULT_SHORTCUTS;

  // Use either props or context values
  const show = isOpen ?? contextShowHelp ?? false;
  const handleClose = () => {
    if (onClose) onClose();
    if (contextSetShowHelp) contextSetShowHelp(false);
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        handleClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [show]);

  if (!show || typeof window === 'undefined') return null;

  // Group shortcuts by category
  const navigationShortcuts = shortcuts.filter((s) =>
    ['n', 'f', ',', 'k'].includes(s.key.toLowerCase())
  );
  const modalShortcuts = shortcuts.filter((s) =>
    ['Escape', '?'].includes(s.key)
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
            >
              <Keyboard size={20} className={isDark ? 'text-white' : 'text-gray-700'} />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                Keyboard Shortcuts
              </h2>
              <p
                className="text-sm"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Quick navigation commands
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
            )}
          >
            <X size={20} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Navigation */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: isDark ? '#888' : '#666' }}
            >
              Navigation
            </h3>
            <div className="space-y-2">
              {navigationShortcuts.map((shortcut, index) => (
                <ShortcutRow
                  key={index}
                  shortcut={formatShortcut(shortcut)}
                  description={shortcut.description}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>

          {/* Modal Controls */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: isDark ? '#888' : '#666' }}
            >
              Modal Controls
            </h3>
            <div className="space-y-2">
              {modalShortcuts.map((shortcut, index) => (
                <ShortcutRow
                  key={index}
                  shortcut={formatShortcut(shortcut)}
                  description={shortcut.description}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t text-center"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <p
            className="text-sm"
            style={{ color: isDark ? '#666' : '#888' }}
          >
            Press <kbd className={cn(
              'px-2 py-0.5 rounded text-xs font-mono',
              isDark ? 'bg-white/10' : 'bg-black/5'
            )}>Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Wrapper that uses the KeyboardShortcuts context
export function ShortcutsHelpModalWithContext({ isDark }: { isDark?: boolean }) {
  // Import dynamically to avoid issues when context is not available
  try {
    const { useKeyboardShortcuts } = require('@/contexts/KeyboardShortcutsContext');
    const { showHelp, setShowHelp } = useKeyboardShortcuts();
    return <ShortcutsHelpModal showHelp={showHelp} setShowHelp={setShowHelp} isDark={isDark} />;
  } catch {
    return null;
  }
}

function ShortcutRow({
  shortcut,
  description,
  isDark,
}: {
  shortcut: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span
        className="text-sm"
        style={{ color: isDark ? '#ccc' : '#444' }}
      >
        {description}
      </span>
      <kbd
        className={cn(
          'px-2.5 py-1 rounded text-xs font-mono font-medium',
          isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-gray-800'
        )}
      >
        {shortcut}
      </kbd>
    </div>
  );
}
