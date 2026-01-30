'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, AlertCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskPriority } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isOverlay?: boolean;
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

export function TaskCard({ task, onClick, isOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
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
  );
}
