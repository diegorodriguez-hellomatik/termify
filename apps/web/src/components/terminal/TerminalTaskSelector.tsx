'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  ListTodo,
  ChevronDown,
  X,
  Check,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, Task, TaskStatus, Team } from '@/lib/api';

interface TerminalTaskSelectorProps {
  terminalId: string;
  activeTaskId?: string | null;
  onTaskChange?: (taskId: string | null, task: Task | null) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  BACKLOG: 'bg-gray-500',
  TODO: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  IN_REVIEW: 'bg-purple-500',
  DONE: 'bg-green-500',
};

const PRIORITY_COLORS = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
};

export function TerminalTaskSelector({
  terminalId,
  activeTaskId,
  onTaskChange,
}: TerminalTaskSelectorProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const accessToken = (session as any)?.accessToken as string | undefined;

  // Load teams on mount
  useEffect(() => {
    const loadTeams = async () => {
      if (!accessToken) return;

      try {
        const response = await api<{ teams: Team[] }>('/api/teams', { token: accessToken });
        if (response.success && response.data) {
          setTeams(response.data.teams);
          if (response.data.teams.length > 0 && !selectedTeamId) {
            setSelectedTeamId(response.data.teams[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      }
    };

    loadTeams();
  }, [accessToken]);

  // Load active task if there's one
  useEffect(() => {
    const loadActiveTask = async () => {
      if (!accessToken || !activeTaskId) {
        setActiveTask(null);
        return;
      }

      try {
        const response = await api<Task>(`/api/tasks/${activeTaskId}`, { token: accessToken });
        if (response.success && response.data) {
          setActiveTask(response.data);
        }
      } catch (error) {
        console.error('Failed to load active task:', error);
        setActiveTask(null);
      }
    };

    loadActiveTask();
  }, [accessToken, activeTaskId]);

  // Load tasks when team changes
  useEffect(() => {
    const loadTasks = async () => {
      if (!accessToken || !selectedTeamId) {
        setTasks([]);
        return;
      }

      setLoadingTasks(true);
      try {
        const response = await api<{ tasks: Task[] }>(`/api/tasks?teamId=${selectedTeamId}`, {
          token: accessToken,
        });
        if (response.success && response.data) {
          // Filter to only show non-done tasks
          setTasks(response.data.tasks.filter((t) => t.status !== 'DONE'));
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    if (open && selectedTeamId) {
      loadTasks();
    }
  }, [accessToken, selectedTeamId, open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelectTask = async (task: Task | null) => {
    if (!accessToken) return;

    setSaving(true);
    try {
      const response = await api<any>(`/api/terminals/${terminalId}/active-task`, {
        method: 'PATCH',
        body: { taskId: task?.id || null },
        token: accessToken,
      });

      if (response.success) {
        setActiveTask(task);
        onTaskChange?.(task?.id || null, task);
        setOpen(false);
      }
    } catch (error) {
      console.error('Failed to set active task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTask = async () => {
    await handleSelectTask(null);
  };

  if (teams.length === 0) {
    return null; // Don't show if user has no teams
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-sm',
          activeTask
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border hover:border-muted-foreground'
        )}
      >
        <ListTodo className="h-4 w-4" />
        {activeTask ? (
          <span className="max-w-[150px] truncate">{activeTask.title}</span>
        ) : (
          <span className="text-muted-foreground">Link task</span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-popover border rounded-lg shadow-lg z-50">
          {/* Header with team selector */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Select Team</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    selectedTeamId === team.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>

          {/* Current task */}
          {activeTask && (
            <div className="p-2 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[activeTask.status])} />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {activeTask.title}
                  </span>
                </div>
                <button
                  onClick={handleClearTask}
                  disabled={saving}
                  className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}

          {/* Tasks list */}
          <div className="max-h-64 overflow-y-auto">
            {loadingTasks ? (
              <div className="p-4 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                No tasks available
              </div>
            ) : (
              tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  disabled={saving || task.id === activeTask?.id}
                  className={cn(
                    'w-full flex items-start gap-2 px-3 py-2 hover:bg-muted text-left',
                    task.id === activeTask?.id && 'bg-primary/5'
                  )}
                >
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5', STATUS_COLORS[task.status])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                    )}
                  </div>
                  {task.id === activeTask?.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t text-xs text-muted-foreground text-center">
            Linking a task tracks work in task history
          </div>
        </div>
      )}
    </div>
  );
}
