'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { personalTasksApi, PersonalTask, TaskPriority } from '@/lib/api';
import { usePersonalTasksSocket, QueueEvent } from './usePersonalTasksSocket';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';

// Priority order for sorting tasks
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface ExecutingTask {
  taskId: string;
  taskTitle: string;
  queueId: string;
  terminalId: string;
  terminalName: string;
  startedAt: Date;
  commandsTotal: number;
  commandsCompleted: number;
}

interface AutoPilotState {
  enabled: boolean;
  executingTasks: Map<string, ExecutingTask>; // terminalId -> ExecutingTask
  availableTasks: PersonalTask[];
  loading: boolean;
  error: string | null;
}

export interface UseAutoPilotReturn {
  // State
  enabled: boolean;
  executingTasks: ExecutingTask[];
  availableTasks: PersonalTask[];
  loading: boolean;
  error: string | null;

  // Actions
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  refreshTasks: () => Promise<void>;

  // Helpers
  getTerminalStatus: (terminalId: string) => 'idle' | 'executing' | 'unavailable';
  getExecutingTask: (terminalId: string) => ExecutingTask | undefined;
  getAvailableTerminals: () => Tab[];
  getPriorityColor: (priority: TaskPriority) => string;
  getPriorityIcon: (priority: TaskPriority) => string;
}

export function useAutoPilot(): UseAutoPilotReturn {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const { tabs } = useWorkspace();

  // State
  const [enabled, setEnabled] = useState(false);
  const [executingTasks, setExecutingTasks] = useState<Map<string, ExecutingTask>>(new Map());
  const [availableTasks, setAvailableTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track pending executions to avoid race conditions
  const pendingExecutions = useRef<Set<string>>(new Set());

  // Get terminal tabs
  const terminalTabs = useMemo(() =>
    tabs.filter((tab): tab is Tab & { terminalId: string } =>
      tab.type === 'terminal' && !!tab.terminalId
    ),
    [tabs]
  );

  // Get available terminals (not currently executing)
  const getAvailableTerminals = useCallback((): Tab[] => {
    return terminalTabs.filter(tab => !executingTasks.has(tab.terminalId));
  }, [terminalTabs, executingTasks]);

  // Get terminal status
  const getTerminalStatus = useCallback((terminalId: string): 'idle' | 'executing' | 'unavailable' => {
    if (executingTasks.has(terminalId)) return 'executing';
    const tab = terminalTabs.find(t => t.terminalId === terminalId);
    if (!tab) return 'unavailable';
    return 'idle';
  }, [terminalTabs, executingTasks]);

  // Get executing task for a terminal
  const getExecutingTask = useCallback((terminalId: string): ExecutingTask | undefined => {
    return executingTasks.get(terminalId);
  }, [executingTasks]);

  // Fetch available tasks (with commands, not yet executing)
  const refreshTasks = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await personalTasksApi.list(accessToken);
      if (response.success && response.data) {
        // Filter tasks that have commands and are in executable status
        const executableTasks = response.data.tasks.filter((task: PersonalTask) => {
          // Must have commands
          if (!task.commands) return false;
          try {
            const commands = JSON.parse(task.commands) as string[];
            if (commands.length === 0) return false;
          } catch {
            return false;
          }

          // Must be in backlog or todo status (not already in_progress or done)
          const status = task.status.toLowerCase();
          return status === 'backlog' || status === 'todo';
        });

        // Sort by priority (highest first)
        executableTasks.sort((a, b) => {
          const priorityA = PRIORITY_ORDER[a.priority as TaskPriority] || 0;
          const priorityB = PRIORITY_ORDER[b.priority as TaskPriority] || 0;
          return priorityB - priorityA;
        });

        setAvailableTasks(executableTasks);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('[useAutoPilot] Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Execute next available task on an available terminal
  const executeNextTask = useCallback(async () => {
    if (!enabled || !accessToken) return;

    const available = getAvailableTerminals();
    if (available.length === 0) return;

    // Find next task that's not already being executed
    const executingTaskIds = new Set(Array.from(executingTasks.values()).map(t => t.taskId));
    const nextTask = availableTasks.find(task =>
      !executingTaskIds.has(task.id) && !pendingExecutions.current.has(task.id)
    );

    if (!nextTask) return;

    // Pick first available terminal
    const terminal = available[0];
    const terminalId = terminal.terminalId!; // We know it exists due to filter

    // Mark as pending to prevent race conditions
    pendingExecutions.current.add(nextTask.id);

    try {
      const response = await personalTasksApi.execute(nextTask.id, { terminalId }, accessToken);

      if (response.success && response.data) {
        const queue = response.data.queue;

        // Add to executing tasks
        setExecutingTasks(prev => {
          const next = new Map(prev);
          next.set(terminalId, {
            taskId: nextTask.id,
            taskTitle: nextTask.title,
            queueId: queue.id,
            terminalId,
            terminalName: terminal.name,
            startedAt: new Date(),
            commandsTotal: queue.commands.length,
            commandsCompleted: 0,
          });
          return next;
        });

        // Remove from available tasks
        setAvailableTasks(prev => prev.filter(t => t.id !== nextTask.id));

        console.log(`[AutoPilot] Started task "${nextTask.title}" on terminal "${terminal.name}"`);
      } else {
        console.error('[AutoPilot] Failed to execute task:', response.error);
      }
    } catch (err) {
      console.error('[AutoPilot] Error executing task:', err);
    } finally {
      pendingExecutions.current.delete(nextTask.id);
    }
  }, [enabled, accessToken, getAvailableTerminals, availableTasks, executingTasks]);

  // WebSocket callbacks for queue events
  const socketCallbacks = useMemo(() => ({
    onTaskUpdated: (task: PersonalTask) => {
      // Update available tasks if task changed to/from executable status
      const status = task.status.toLowerCase();
      if (status === 'backlog' || status === 'todo') {
        // May need to add to available tasks
        if (task.commands) {
          try {
            const commands = JSON.parse(task.commands) as string[];
            if (commands.length > 0) {
              setAvailableTasks(prev => {
                if (prev.some(t => t.id === task.id)) {
                  return prev.map(t => t.id === task.id ? task : t);
                }
                // Add and sort
                const next = [...prev, task];
                next.sort((a, b) => {
                  const priorityA = PRIORITY_ORDER[a.priority as TaskPriority] || 0;
                  const priorityB = PRIORITY_ORDER[b.priority as TaskPriority] || 0;
                  return priorityB - priorityA;
                });
                return next;
              });
            }
          } catch {
            // Ignore parse errors
          }
        }
      } else {
        // Remove from available tasks
        setAvailableTasks(prev => prev.filter(t => t.id !== task.id));
      }
    },
    onTaskDeleted: (taskId: string) => {
      setAvailableTasks(prev => prev.filter(t => t.id !== taskId));
    },
    onQueueStarted: (event: QueueEvent) => {
      console.log('[AutoPilot] Queue started:', event.queueId);
    },
    onQueueCompleted: (event: QueueEvent) => {
      console.log('[AutoPilot] Queue completed:', event.queueId);
      // Remove from executing tasks
      setExecutingTasks(prev => {
        const next = new Map(prev);
        for (const [terminalId, task] of next) {
          if (task.queueId === event.queueId) {
            next.delete(terminalId);
            break;
          }
        }
        return next;
      });
    },
    onQueueFailed: (event: QueueEvent) => {
      console.log('[AutoPilot] Queue failed:', event.queueId, event.reason);
      // Remove from executing tasks
      setExecutingTasks(prev => {
        const next = new Map(prev);
        for (const [terminalId, task] of next) {
          if (task.queueId === event.queueId) {
            next.delete(terminalId);
            break;
          }
        }
        return next;
      });
    },
    onQueueCancelled: (event: QueueEvent) => {
      console.log('[AutoPilot] Queue cancelled:', event.queueId);
      // Remove from executing tasks
      setExecutingTasks(prev => {
        const next = new Map(prev);
        for (const [terminalId, task] of next) {
          if (task.queueId === event.queueId) {
            next.delete(terminalId);
            break;
          }
        }
        return next;
      });
    },
    onQueueCommandCompleted: (event: QueueEvent & { commandId: string; exitCode: number }) => {
      // Update progress
      setExecutingTasks(prev => {
        const next = new Map(prev);
        for (const [terminalId, task] of next) {
          if (task.queueId === event.queueId) {
            next.set(terminalId, {
              ...task,
              commandsCompleted: task.commandsCompleted + 1,
            });
            break;
          }
        }
        return next;
      });
    },
  }), []);

  // Connect to WebSocket
  usePersonalTasksSocket({
    token: accessToken || null,
    callbacks: socketCallbacks,
  });

  // Load tasks on mount
  useEffect(() => {
    if (accessToken) {
      refreshTasks();
    }
  }, [accessToken, refreshTasks]);

  // Auto-execute when enabled and terminals become available
  useEffect(() => {
    if (!enabled) return;

    // Check if we can execute
    const available = getAvailableTerminals();
    const executingIds = new Set(Array.from(executingTasks.values()).map(t => t.taskId));
    const hasTasksToExecute = availableTasks.some(t => !executingIds.has(t.id));

    if (available.length > 0 && hasTasksToExecute) {
      executeNextTask();
    }
  }, [enabled, executingTasks, availableTasks, getAvailableTerminals, executeNextTask]);

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  // Priority helpers
  const getPriorityColor = useCallback((priority: TaskPriority): string => {
    switch (priority) {
      case 'URGENT': return 'text-red-500';
      case 'HIGH': return 'text-orange-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  }, []);

  const getPriorityIcon = useCallback((priority: TaskPriority): string => {
    switch (priority) {
      case 'URGENT': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }, []);

  return {
    // State
    enabled,
    executingTasks: Array.from(executingTasks.values()),
    availableTasks,
    loading,
    error,

    // Actions
    setEnabled,
    toggleEnabled,
    refreshTasks,

    // Helpers
    getTerminalStatus,
    getExecutingTask,
    getAvailableTerminals,
    getPriorityColor,
    getPriorityIcon,
  };
}
