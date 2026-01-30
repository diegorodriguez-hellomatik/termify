'use client';

import { useEffect, useRef } from 'react';
import { Plus, FolderPlus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlankAreaContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  // Generic action (for simple menus)
  onAction?: () => void;
  actionLabel?: string;
  // Specific actions (for complex menus)
  onCreateTask?: () => void;
  onCreateWorkspace?: () => void;
  onOpenSettings?: () => void;
}

export function BlankAreaContextMenu({
  x,
  y,
  onClose,
  onAction,
  actionLabel,
  onCreateTask,
  onCreateWorkspace,
  onOpenSettings,
}: BlankAreaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* Generic action */}
      {onAction && (
        <button
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
            "hover:bg-accent hover:text-accent-foreground transition-colors"
          )}
          onClick={() => {
            onAction();
            onClose();
          }}
        >
          <Plus className="h-4 w-4" />
          {actionLabel || 'Action'}
        </button>
      )}
      {/* Specific create task action */}
      {onCreateTask && (
        <button
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
            "hover:bg-accent hover:text-accent-foreground transition-colors"
          )}
          onClick={() => {
            onCreateTask();
            onClose();
          }}
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      )}
      {onCreateWorkspace && (
        <button
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
            "hover:bg-accent hover:text-accent-foreground transition-colors"
          )}
          onClick={() => {
            onCreateWorkspace();
            onClose();
          }}
        >
          <FolderPlus className="h-4 w-4" />
          New Workspace
        </button>
      )}
      {onOpenSettings && (
        <>
          <div className="border-t border-border my-1" />
          <button
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
              "hover:bg-accent hover:text-accent-foreground transition-colors"
            )}
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </>
      )}
    </div>
  );
}
