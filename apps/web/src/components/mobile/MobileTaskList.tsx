'use client';

import { useState, useCallback } from 'react';
import { CheckSquare, Circle, Clock, AlertCircle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { TaskPriority, PersonalTask, TaskStatusConfig } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

interface MobileTaskListProps {
  tasksByStatus: Record<string, PersonalTask[]>;
  statuses: TaskStatusConfig[];
  onTaskClick?: (task: PersonalTask) => void;
  onCreateTask?: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

type StatusFilter = string | null;

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bgColor: string; label: string }> = {
  URGENT: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Urgent' },
  HIGH: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'High' },
  MEDIUM: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Medium' },
  LOW: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Low' },
};

const STATUS_ICONS: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  in_review: AlertCircle,
  done: CheckCircle2,
};

function MobileTaskCard({
  task,
  onClick,
}: {
  task: PersonalTask;
  onClick?: () => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];
  const StatusIcon = STATUS_ICONS[task.status] || Circle;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3',
        'py-3 px-4',
        'bg-card',
        'active:bg-muted transition-colors',
        'touch-manipulation cursor-pointer'
      )}
    >
      {/* Status icon */}
      <StatusIcon
        className={cn(
          'w-5 h-5 flex-shrink-0',
          task.status === 'done' ? 'text-green-500' : 'text-muted-foreground'
        )}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            'font-medium text-foreground truncate',
            task.status === 'done' && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {/* Priority badge */}
          <span className={cn('text-xs font-medium', priorityConfig.color)}>
            {priorityConfig.label}
          </span>
          {/* Due date */}
          {task.dueDate && (
            <>
              <span className="text-muted-foreground text-xs">&bull;</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(task.dueDate)}
              </span>
            </>
          )}
          {/* Workspace ID indicator */}
          {task.workspaceId && (
            <>
              <span className="text-muted-foreground text-xs">&bull;</span>
              <span className="text-xs text-muted-foreground">
                In workspace
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

export function MobileTaskList({
  tasksByStatus,
  statuses,
  onTaskClick,
  onCreateTask,
  onRefresh,
  isLoading = false,
}: MobileTaskListProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleStatusFilter = useCallback((status: StatusFilter) => {
    setSelectedStatus((prev) => (prev === status ? null : status));
  }, []);

  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  // Get all tasks
  const allTasks = Object.values(tasksByStatus).flat();

  // Filter by selected status
  const filteredTasks = selectedStatus
    ? tasksByStatus[selectedStatus] || []
    : allTasks;

  // Sort by priority then by due date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
    if (aPriority !== bPriority) return aPriority - bPriority;

    // Then by due date
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  // Count tasks by status
  const statusCounts: Record<string, number> = {};
  statuses.forEach((status) => {
    statusCounts[status.id] = (tasksByStatus[status.id] || []).length;
  });

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="My Tasks"
        subtitle={`${allTasks.length} task${allTasks.length !== 1 ? 's' : ''}`}
        onCreateClick={onCreateTask}
      />

      {/* Status Filters */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {/* All filter */}
          <button
            onClick={() => handleStatusFilter(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'min-h-[36px]',
              selectedStatus === null
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
            <span className="opacity-70">{allTasks.length}</span>
          </button>

          {/* Status filters */}
          {statuses.map((status) => {
            const count = statusCounts[status.id] || 0;
            if (count === 0) return null;

            return (
              <button
                key={status.id}
                onClick={() => handleStatusFilter(status.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  'min-h-[36px]',
                  selectedStatus === status.id
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground'
                )}
                style={{
                  backgroundColor: selectedStatus === status.id ? status.color : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: selectedStatus === status.id ? 'white' : status.color,
                  }}
                />
                {count}
              </button>
            );
          })}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                'ml-auto p-2 rounded-full transition-all',
                'min-h-[36px] min-w-[36px] flex items-center justify-center',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'disabled:opacity-50'
              )}
            >
              <RefreshCw
                size={18}
                className={cn((isRefreshing || isLoading) && 'animate-spin')}
              />
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-muted rounded mb-1" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="w-4 h-4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : sortedTasks.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <CheckSquare size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              {selectedStatus
                ? 'No tasks with this status'
                : 'No tasks yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {selectedStatus
                ? 'Try selecting a different filter'
                : 'Create a task to get started'}
            </p>
          </div>
        ) : (
          // Task cards
          <div className="divide-y divide-border">
            {sortedTasks.map((task) => (
              <MobileTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
