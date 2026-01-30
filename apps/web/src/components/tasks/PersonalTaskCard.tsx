'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, AlertCircle, Terminal, Play, Edit2, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonalTask, TaskPriority } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface PersonalTaskCardProps {
  task: PersonalTask;
  onClick?: () => void;
  isOverlay?: boolean;
  onExecute?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onDuplicate?: (task: PersonalTask) => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function PersonalTaskCard({ task, onClick, isOverlay, onExecute, onDelete, onDuplicate }: PersonalTaskCardProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isOverlay) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Parse commands if they exist
  const commands = task.commands ? (() => {
    try {
      return JSON.parse(task.commands) as string[];
    } catch {
      return [];
    }
  })() : [];

  const hasCommands = commands.length > 0;

  const handleDragStart = (e: React.DragEvent) => {
    // Set data for dropping onto FloatingTerminal
    e.dataTransfer.setData('application/task-id', task.id);
    e.dataTransfer.setData('text/plain', task.title);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={isOverlay ? undefined : onClick}
      onContextMenu={handleContextMenu}
      draggable={hasCommands && !isOverlay}
      onDragStart={hasCommands && !isOverlay ? handleDragStart : undefined}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors',
        isDragging && 'shadow-lg ring-2 ring-primary',
        isOverlay && 'shadow-xl rotate-2',
        hasCommands && 'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Priority indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_COLORS[task.priority])} />
          <span className="text-[10px] text-muted-foreground uppercase">
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        {/* Commands indicator */}
        {hasCommands && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${commands.length} commands - drag to terminal to execute`}>
            <Terminal className="h-3 w-3" />
            <span>{commands.length}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium line-clamp-2 mb-2">{task.title}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      {/* Commands preview */}
      {hasCommands && (
        <div className="mb-2 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground line-clamp-2">
          {commands[0]}
          {commands.length > 1 && <span className="text-muted-foreground/50"> +{commands.length - 1} more</span>}
        </div>
      )}

      {/* Execute button if has commands and onExecute is provided */}
      {hasCommands && onExecute && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExecute(task.id);
          }}
          className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
        >
          <Play className="h-3 w-3" />
          Execute in terminal
        </button>
      )}

      {/* Execution status */}
      {task.executedAt && (
        <div className="mb-2 text-xs text-muted-foreground">
          Executed {formatDistanceToNow(new Date(task.executedAt), { addSuffix: true })}
        </div>
      )}

      {/* Footer - Due date */}
      {task.dueDate && (
        <div className="mt-2 pt-2 border-t border-border">
          <div
            className={cn(
              'flex items-center gap-1 text-xs',
              isOverdue ? 'text-red-500' : 'text-muted-foreground'
            )}
          >
            {isOverdue ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>
              {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
            </span>
          </div>
        </div>
      )}
    </div>

    {/* Context Menu */}
    {contextMenu && typeof document !== 'undefined' && createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[9998]"
          onClick={closeContextMenu}
          onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
        />
        {/* Menu */}
        <div
          className="fixed z-[9999] min-w-[160px] py-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 176),
            top: Math.min(contextMenu.y, window.innerHeight - 120),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeContextMenu();
              onClick?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
          >
            <Edit2 className="h-4 w-4 text-muted-foreground" />
            Edit
          </button>
          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeContextMenu();
                onDuplicate(task);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              Duplicate
            </button>
          )}
          {onDelete && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeContextMenu();
                  onDelete(task.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </>,
      document.body
    )}
    </>
  );
}
