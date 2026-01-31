'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, MoreVertical, Plus, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { TaskPriority, PersonalTask, TaskStatusConfig, Workspace } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

interface MobileTaskListProps {
  tasksByStatus: Record<string, PersonalTask[]>;
  statuses: TaskStatusConfig[];
  workspaces?: Workspace[];
  selectedWorkspaceId?: string | null;
  onSelectWorkspace?: (workspaceId: string | null) => void;
  onTaskClick?: (task: PersonalTask) => void;
  onCreateTask?: () => void;
  onCreateTaskInStatus?: (statusId: string) => void;
  onRefresh?: () => Promise<void>;
  onUpdateTaskStatus?: (taskId: string, newStatus: string) => Promise<void>;
  isLoading?: boolean;
}

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bgColor: string; label: string }> = {
  URGENT: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Urgent' },
  HIGH: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'High' },
  MEDIUM: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Medium' },
  LOW: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Low' },
};

function TaskCard({
  task,
  statuses,
  currentStatusId,
  onClick,
  onMoveToStatus,
}: {
  task: PersonalTask;
  statuses: TaskStatusConfig[];
  currentStatusId: string;
  onClick?: () => void;
  onMoveToStatus?: (statusId: string) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  return (
    <div className="relative">
      <div
        onClick={onClick}
        className={cn(
          'bg-card border border-border rounded-lg p-3',
          'active:scale-[0.98] transition-all',
          'touch-manipulation cursor-pointer'
        )}
      >
        <div className="flex items-start gap-2">
          <p className={cn(
            'font-medium text-sm text-foreground line-clamp-2 flex-1',
            task.status === 'done' && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>
          {onMoveToStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoveMenu(!showMoveMenu);
              }}
              className="p-1 -mr-1 -mt-1 rounded hover:bg-muted text-muted-foreground"
            >
              <MoreVertical size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            priorityConfig.bgColor,
            priorityConfig.color
          )}>
            {priorityConfig.label}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Move menu */}
      {showMoveMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMoveMenu(false)}
          />
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
              Move to
            </div>
            {statuses.map((status) => (
              <button
                key={status.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(false);
                  if (status.id !== currentStatusId) {
                    onMoveToStatus?.(status.id);
                  }
                }}
                disabled={status.id === currentStatusId}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  'hover:bg-muted transition-colors',
                  status.id === currentStatusId && 'opacity-50 cursor-not-allowed bg-muted/50'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <span>{status.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusSection({
  status,
  tasks,
  statuses,
  isExpanded,
  onToggle,
  onTaskClick,
  onMoveTask,
  onAddTask,
}: {
  status: TaskStatusConfig;
  tasks: PersonalTask[];
  statuses: TaskStatusConfig[];
  isExpanded: boolean;
  onToggle: () => void;
  onTaskClick?: (task: PersonalTask) => void;
  onMoveTask?: (taskId: string, newStatusId: string) => void;
  onAddTask?: () => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-3',
          'bg-muted/30 hover:bg-muted/50 transition-colors'
        )}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="font-medium text-sm flex-1 text-left">{status.name}</span>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
        {isExpanded ? (
          <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground" />
        )}
      </button>

      {/* Tasks */}
      {isExpanded && (
        <div className="p-2 space-y-2 bg-background">
          {tasks.length === 0 ? (
            <button
              onClick={onAddTask}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-2 py-6',
                'border-2 border-dashed border-border/50 rounded-lg',
                'hover:border-primary/50 hover:bg-primary/5 transition-colors',
                'text-muted-foreground hover:text-primary'
              )}
            >
              <Plus size={20} />
              <span className="text-xs">Add task</span>
            </button>
          ) : (
            <>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  currentStatusId={status.id}
                  onClick={() => onTaskClick?.(task)}
                  onMoveToStatus={onMoveTask ? (newStatusId) => onMoveTask(task.id, newStatusId) : undefined}
                />
              ))}
              {/* Add task button at bottom */}
              <button
                onClick={onAddTask}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2',
                  'border border-dashed border-border/50 rounded-lg',
                  'hover:border-primary/50 hover:bg-primary/5 transition-colors',
                  'text-xs text-muted-foreground hover:text-primary'
                )}
              >
                <Plus size={14} />
                <span>Add task</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileTaskList({
  tasksByStatus,
  statuses,
  workspaces = [],
  selectedWorkspaceId,
  onSelectWorkspace,
  onTaskClick,
  onCreateTask,
  onCreateTaskInStatus,
  onRefresh,
  onUpdateTaskStatus,
  isLoading = false,
}: MobileTaskListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track which sections are expanded - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(statuses.map(s => s.id))
  );

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

  const toggleSection = useCallback((statusId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  }, []);

  // Get all tasks count
  const allTasks = Object.values(tasksByStatus).flat();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with refresh */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div>
          <h1 className="text-xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {allTasks.length} task{allTasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                'p-2 rounded-full',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'disabled:opacity-50 transition-all'
              )}
            >
              <RefreshCw
                size={18}
                className={cn((isRefreshing || isLoading) && 'animate-spin')}
              />
            </button>
          )}
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Workspace Tabs - Horizontal scrollable */}
      {onSelectWorkspace && (
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-border bg-background">
          {/* All Tasks Tab */}
          <button
            onClick={() => onSelectWorkspace(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
              selectedWorkspaceId === null
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
          </button>

          {/* Workspace Tabs */}
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                selectedWorkspaceId === workspace.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground'
              )}
              style={{
                backgroundColor:
                  selectedWorkspaceId === workspace.id
                    ? workspace.color || '#6366f1'
                    : undefined,
              }}
            >
              <Folder size={12} />
              {workspace.name}
            </button>
          ))}

          {/* Independent Tasks Tab */}
          <button
            onClick={() => onSelectWorkspace('independent')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
              selectedWorkspaceId === 'independent'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Independent
          </button>
        </div>
      )}

      {/* Board sections - vertical */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {statuses.map((status) => {
            const tasks = tasksByStatus[status.id] || [];

            return (
              <div key={status.id} id={`section-${status.id}`}>
                <StatusSection
                  status={status}
                  tasks={tasks}
                  statuses={statuses}
                  isExpanded={expandedSections.has(status.id)}
                  onToggle={() => toggleSection(status.id)}
                  onTaskClick={onTaskClick}
                  onMoveTask={onUpdateTaskStatus}
                  onAddTask={() => {
                    if (onCreateTaskInStatus) {
                      onCreateTaskInStatus(status.id);
                    } else if (onCreateTask) {
                      onCreateTask();
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
