'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, AlertCircle, User, Edit2, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskPriority } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isOverlay?: boolean;
  onDelete?: (taskId: string) => void;
  onDuplicate?: (task: Task) => void;
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

export function TaskCard({ task, onClick, isOverlay, onDelete, onDuplicate }: TaskCardProps) {
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

  return (
    <>
      <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={isOverlay ? undefined : onClick}
      onContextMenu={handleContextMenu}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors',
        isDragging && 'shadow-lg ring-2 ring-primary',
        isOverlay && 'shadow-xl rotate-2'
      )}
    >
      {/* Priority indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_COLORS[task.priority])} />
        <span className="text-[10px] text-muted-foreground uppercase">
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium line-clamp-2 mb-2">{task.title}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        {/* Due date */}
        <div className="flex items-center gap-1.5">
          {task.dueDate ? (
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
          ) : (
            <span className="text-xs text-muted-foreground">No due date</span>
          )}
        </div>

        {/* Assignees */}
        <div className="flex items-center -space-x-2">
          {task.assignees && task.assignees.length > 0 ? (
            <>
              {task.assignees.slice(0, 3).map((assignee, index) => (
                <div
                  key={assignee.id}
                  className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium"
                  style={{ zIndex: 3 - index }}
                  title={assignee.teamMember?.user?.name || assignee.teamMember?.user?.email || ''}
                >
                  {assignee.teamMember?.user?.image ? (
                    <img
                      src={assignee.teamMember.user.image}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (assignee.teamMember?.user?.name || assignee.teamMember?.user?.email || '?')
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium">
                  +{task.assignees.length - 3}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Unassigned</span>
            </div>
          )}
        </div>
      </div>
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
