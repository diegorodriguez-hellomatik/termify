'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string, ctrl?: boolean, meta?: boolean, shift?: boolean) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(
  undefined
);

function isInputElement(element: EventTarget | null): boolean {
  if (!element) return false;
  const tagName = (element as HTMLElement).tagName?.toLowerCase();
  const isEditable = (element as HTMLElement).isContentEditable;
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable;
}

function matchShortcut(
  e: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
  const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

  return keyMatch && ctrlMatch && shiftMatch;
}

export function KeyboardShortcutsProvider({
  children,
  onCreateTerminal,
  onFocusSearch,
  onOpenSettings,
}: {
  children: ReactNode;
  onCreateTerminal?: () => void;
  onFocusSearch?: () => void;
  onOpenSettings?: () => void;
}) {
  const router = useRouter();
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [enabled, setEnabled] = useState(true);

  // Register a new shortcut
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => {
      // Remove existing shortcut with same key combo
      const filtered = prev.filter(
        (s) =>
          !(
            s.key === shortcut.key &&
            s.ctrl === shortcut.ctrl &&
            s.meta === shortcut.meta &&
            s.shift === shortcut.shift
          )
      );
      return [...filtered, shortcut];
    });
  }, []);

  // Unregister a shortcut
  const unregisterShortcut = useCallback(
    (key: string, ctrl?: boolean, meta?: boolean, shift?: boolean) => {
      setShortcuts((prev) =>
        prev.filter(
          (s) =>
            !(
              s.key === key &&
              s.ctrl === ctrl &&
              s.meta === meta &&
              s.shift === shift
            )
        )
      );
    },
    []
  );

  // Register default shortcuts
  useEffect(() => {
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        key: 'n',
        ctrl: true,
        description: 'Create new terminal',
        action: () => onCreateTerminal?.(),
      },
      {
        key: 'f',
        ctrl: true,
        description: 'Focus search',
        action: () => onFocusSearch?.(),
      },
      {
        key: ',',
        ctrl: true,
        description: 'Open settings',
        action: () => {
          if (onOpenSettings) {
            onOpenSettings();
          } else {
            router.push('/settings');
          }
        },
      },
      {
        key: 'Escape',
        description: 'Close modal / Clear search',
        action: () => {
          setShowHelp(false);
        },
      },
      {
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(true),
      },
    ];

    defaultShortcuts.forEach(registerShortcut);

    return () => {
      defaultShortcuts.forEach((s) =>
        unregisterShortcut(s.key, s.ctrl, s.meta, s.shift)
      );
    };
  }, [registerShortcut, unregisterShortcut, router, onCreateTerminal, onFocusSearch, onOpenSettings]);

  // Global keyboard listener
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except Escape)
      if (isInputElement(e.target) && e.key !== 'Escape') {
        return;
      }

      for (const shortcut of shortcuts) {
        if (matchShortcut(e, shortcut)) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        showHelp,
        setShowHelp,
        enabled,
        setEnabled,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcuts must be used within a KeyboardShortcutsProvider'
    );
  }
  return context;
}

// Helper to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) {
    // Show Cmd on Mac, Ctrl on Windows/Linux
    parts.push(typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }

  // Format special keys
  let keyDisplay = shortcut.key;
  if (shortcut.key === 'Escape') keyDisplay = 'Esc';
  else if (shortcut.key === ',') keyDisplay = ',';
  else if (shortcut.key === '?') keyDisplay = '?';
  else keyDisplay = shortcut.key.toUpperCase();

  parts.push(keyDisplay);

  return parts.join(' + ');
}
