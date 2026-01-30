'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

interface BlankAreaContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: () => void;
  actionLabel: string;
}

export function BlankAreaContextMenu({
  x,
  y,
  onClose,
  onAction,
  actionLabel,
}: BlankAreaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 100);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-popover overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        onClick={() => {
          onAction();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        <Plus size={16} className="text-primary" />
        <span>{actionLabel}</span>
      </button>
    </div>,
    document.body
  );
}

// Helper hook for context menu
export function useBlankAreaContextMenu() {
  const handleContextMenu = (
    e: React.MouseEvent,
    setContextMenu: (pos: { x: number; y: number } | null) => void
  ) => {
    const target = e.target as HTMLElement;
    // Don't show on interactive elements
    if (target.closest('button, a, input, textarea, [role="button"], [data-no-context-menu]')) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return { handleContextMenu };
}
