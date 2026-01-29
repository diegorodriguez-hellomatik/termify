'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ListTodo,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
}

interface TasksPanelProps {
  terminalId: string;
  className?: string;
}

const STATUS_ICONS: Record<TaskStatus, React.FC<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-yellow-500',
  completed: 'text-green-500',
};

function TaskItem({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = STATUS_ICONS[task.status];

  return (
    <div className="group">
      <div
        className={cn(
          'flex items-start gap-2 px-3 py-1.5 hover:bg-muted/50 rounded-md cursor-pointer transition-colors',
          task.status === 'completed' && 'opacity-60'
        )}
        onClick={() => task.description && setExpanded(!expanded)}
      >
        <Icon
          className={cn(
            'h-4 w-4 mt-0.5 flex-shrink-0',
            STATUS_COLORS[task.status],
            task.status === 'in_progress' && 'animate-spin'
          )}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm leading-tight',
              task.status === 'completed' && 'line-through'
            )}
          >
            {task.title}
          </p>
        </div>
        {task.description && (
          <button className="opacity-0 group-hover:opacity-100 transition-opacity">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      {expanded && task.description && (
        <div className="ml-9 mr-3 mb-2 text-xs text-muted-foreground">
          {task.description}
        </div>
      )}
    </div>
  );
}

export function TasksPanel({ terminalId, className }: TasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collapsed, setCollapsed] = useState<Record<TaskStatus, boolean>>({
    pending: false,
    in_progress: false,
    completed: true, // Start with completed collapsed
  });

  // Listen for task updates from terminal
  useEffect(() => {
    const handleTaskUpdate = (event: CustomEvent<{ terminalId: string; tasks: Task[] }>) => {
      if (event.detail.terminalId === terminalId) {
        setTasks(event.detail.tasks);
      }
    };

    // Listen for task list updates
    window.addEventListener('terminal-tasks-update', handleTaskUpdate as EventListener);

    return () => {
      window.removeEventListener('terminal-tasks-update', handleTaskUpdate as EventListener);
    };
  }, [terminalId]);

  // Parse tasks from terminal output (you can call this from the terminal component)
  // This is a simplified version - real implementation would parse Claude Code's task format

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const toggleSection = (status: TaskStatus) => {
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }));
  };

  if (tasks.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 px-4', className)}>
        <ListTodo className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          No tasks detected yet.
        </p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          Tasks from Claude Code will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* In Progress */}
      {inProgressTasks.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('in_progress')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-md"
          >
            {collapsed.in_progress ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            IN PROGRESS ({inProgressTasks.length})
          </button>
          {!collapsed.in_progress && (
            <div className="mt-1">
              {inProgressTasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending */}
      {pendingTasks.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('pending')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-md"
          >
            {collapsed.pending ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            PENDING ({pendingTasks.length})
          </button>
          {!collapsed.pending && (
            <div className="mt-1">
              {pendingTasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => toggleSection('completed')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-md"
          >
            {collapsed.completed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            COMPLETED ({completedTasks.length})
          </button>
          {!collapsed.completed && (
            <div className="mt-1">
              {completedTasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="mt-auto px-3 py-2 border-t border-border text-xs text-muted-foreground">
        {completedTasks.length} of {tasks.length} tasks completed
      </div>
    </div>
  );
}

// Helper function to dispatch task updates (can be called from terminal parsing logic)
export function dispatchTaskUpdate(terminalId: string, tasks: Task[]) {
  window.dispatchEvent(new CustomEvent('terminal-tasks-update', {
    detail: { terminalId, tasks }
  }));
}
