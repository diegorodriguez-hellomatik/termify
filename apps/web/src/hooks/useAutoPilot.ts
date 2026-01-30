'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { personalTasksApi, terminalsApi, terminalQueueApi, PersonalTask, TaskPriority } from '@/lib/api';
import { usePersonalTasksSocket, QueueEvent } from './usePersonalTasksSocket';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';

// Priority order for sorting tasks
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Maximum terminals to create automatically
const MAX_AUTO_TERMINALS = 3;

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

// Generate Claude Code prompt from task
function generateClaudePrompt(task: PersonalTask): string {
  let prompt = task.title;
  if (task.description) {
    prompt += `\n\n${task.description}`;
  }
  // Escape special characters for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `claude "${escapedPrompt}"`;
}

export function useAutoPilot(): UseAutoPilotReturn {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const { tabs, openTab } = useWorkspace();

  // State
  const [enabled, setEnabled] = useState(false);
  const [executingTasks, setExecutingTasks] = useState<Map<string, ExecutingTask>>(new Map());
  const [availableTasks, setAvailableTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track pending executions to avoid race conditions
  const pendingExecutions = useRef<Set<string>>(new Set());
  // Flag to prevent concurrent executeNextTask calls
  const isExecutingRef = useRef(false);
  // Debounce timer for auto-execution
  const executeDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch available tasks (ALL tasks in backlog/todo status)
  const refreshTasks = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await personalTasksApi.list(accessToken);
      if (response.success && response.data) {
        // Filter tasks that are in executable status (backlog or todo)
        // Accept ALL tasks, not just those with commands
        const executableTasks = response.data.tasks.filter((task: PersonalTask) => {
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

  // Track created terminals count to limit auto-creation
  const createdTerminalsCount = useRef(0);

  // Create a new terminal for auto-pilot
  const createTerminalForAutoPilot = useCallback(async (): Promise<{ terminalId: string; name: string } | null> => {
    if (!accessToken) return null;
    if (createdTerminalsCount.current >= MAX_AUTO_TERMINALS) {
      console.log('[AutoPilot] Max auto-created terminals reached');
      return null;
    }

    try {
      const terminalName = `AutoPilot-${createdTerminalsCount.current + 1}`;
      const response = await terminalsApi.create({ name: terminalName }, accessToken);

      if (response.success && response.data) {
        createdTerminalsCount.current++;
        const terminalId = response.data.id;
        console.log(`[AutoPilot] Created new terminal: ${terminalName} (${terminalId})`);

        // Open the terminal in the workspace so it's visible and has a WebSocket connection
        openTab(terminalId, terminalName);

        // Give some time for the terminal to initialize and connect
        await new Promise(resolve => setTimeout(resolve, 2000));

        return { terminalId, name: terminalName };
      }
    } catch (err) {
      console.error('[AutoPilot] Failed to create terminal:', err);
    }
    return null;
  }, [accessToken, openTab]);

  // Execute next available task on an available terminal
  const executeNextTask = useCallback(async () => {
    if (!enabled || !accessToken) return;

    // Prevent concurrent executions
    if (isExecutingRef.current) {
      console.log('[AutoPilot] Already executing, skipping...');
      return;
    }

    // Find next task that's not already being executed
    const executingTaskIds = new Set(Array.from(executingTasks.values()).map(t => t.taskId));
    const nextTask = availableTasks.find(task =>
      !executingTaskIds.has(task.id) && !pendingExecutions.current.has(task.id)
    );

    if (!nextTask) return;

    // Set executing flag
    isExecutingRef.current = true;

    // Try to get an available terminal
    let terminalId: string;
    let terminalName: string;

    const available = getAvailableTerminals();
    if (available.length > 0) {
      // Use existing available terminal
      const terminal = available[0];
      terminalId = terminal.terminalId!;
      terminalName = terminal.name;
    } else {
      // No terminals available - try to create one
      const newTerminal = await createTerminalForAutoPilot();
      if (!newTerminal) {
        console.log('[AutoPilot] No terminals available and cannot create more');
        return;
      }
      terminalId = newTerminal.terminalId;
      terminalName = newTerminal.name;
    }

    // Mark as pending to prevent race conditions
    pendingExecutions.current.add(nextTask.id);

    try {
      // Check if task has commands
      let hasCommands = false;
      try {
        const commands = nextTask.commands ? JSON.parse(nextTask.commands) as string[] : [];
        hasCommands = commands.length > 0;
      } catch {
        hasCommands = false;
      }

      let queueId: string;
      let commandsTotal: number;

      if (hasCommands) {
        // Task has predefined commands - use the execute endpoint
        const response = await personalTasksApi.execute(nextTask.id, { terminalId }, accessToken);

        if (!response.success || !response.data) {
          console.error('[AutoPilot] Failed to execute task:', response.error);
          return;
        }

        queueId = response.data.queue.id;
        commandsTotal = response.data.queue.commands.length;
      } else {
        // Task has no commands - create a queue with Claude Code prompt
        const claudePrompt = generateClaudePrompt(nextTask);

        // First update task status to in_progress
        await personalTasksApi.update(nextTask.id, { status: 'in_progress' }, accessToken);

        // Create a queue with the Claude prompt
        const queueResponse = await terminalQueueApi.create(
          terminalId,
          {
            name: `AutoPilot: ${nextTask.title}`,
            commands: [{ command: claudePrompt, position: 0 }],
          },
          accessToken
        );

        if (!queueResponse.success || !queueResponse.data) {
          console.error('[AutoPilot] Failed to create queue:', queueResponse.error);
          return;
        }

        queueId = queueResponse.data.queue.id;
        commandsTotal = 1;
      }

      // Add to executing tasks
      setExecutingTasks(prev => {
        const next = new Map(prev);
        next.set(terminalId, {
          taskId: nextTask.id,
          taskTitle: nextTask.title,
          queueId,
          terminalId,
          terminalName,
          startedAt: new Date(),
          commandsTotal,
          commandsCompleted: 0,
        });
        return next;
      });

      // Remove from available tasks
      setAvailableTasks(prev => prev.filter(t => t.id !== nextTask.id));

      console.log(`[AutoPilot] Started task "${nextTask.title}" on terminal "${terminalName}" (${hasCommands ? 'commands' : 'Claude Code'})`);
    } catch (err) {
      console.error('[AutoPilot] Error executing task:', err);
    } finally {
      pendingExecutions.current.delete(nextTask.id);
      // Clear executing flag after a delay to prevent rapid re-execution
      setTimeout(() => {
        isExecutingRef.current = false;
      }, 1000);
    }
  }, [enabled, accessToken, getAvailableTerminals, availableTasks, executingTasks, createTerminalForAutoPilot]);

  // Track tasks that have already been updated to avoid duplicate updates
  const updatedTasksRef = useRef<Set<string>>(new Set());

  // Helper to update task status via API
  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    if (!accessToken) return;

    // Avoid duplicate updates
    const updateKey = `${taskId}:${status}`;
    if (updatedTasksRef.current.has(updateKey)) {
      console.log(`[AutoPilot] Task ${taskId} already updated to ${status}, skipping`);
      return;
    }
    updatedTasksRef.current.add(updateKey);

    try {
      await personalTasksApi.update(taskId, { status: status as any }, accessToken);
      console.log(`[AutoPilot] Updated task ${taskId} status to ${status}`);
    } catch (err) {
      console.error(`[AutoPilot] Failed to update task status:`, err);
      // Remove from set so it can be retried
      updatedTasksRef.current.delete(updateKey);
    }
  }, [accessToken]);

  // WebSocket callbacks for queue events
  const socketCallbacks = useMemo(() => ({
    onTaskUpdated: (task: PersonalTask) => {
      // Update available tasks if task changed to/from executable status
      const status = task.status.toLowerCase();
      if (status === 'backlog' || status === 'todo') {
        // Add to available tasks if not already there
        setAvailableTasks(prev => {
          if (prev.some(t => t.id === task.id)) {
            return prev.map(t => t.id === task.id ? task : t);
          }
          // Add and sort by priority
          const next = [...prev, task];
          next.sort((a, b) => {
            const priorityA = PRIORITY_ORDER[a.priority as TaskPriority] || 0;
            const priorityB = PRIORITY_ORDER[b.priority as TaskPriority] || 0;
            return priorityB - priorityA;
          });
          return next;
        });
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
      console.log('[AutoPilot] Queue completed event received:', event.queueId);
      // Find the executing task and update its status to in_review
      // Only process if this queue belongs to AutoPilot
      setExecutingTasks(prev => {
        const next = new Map(prev);
        let found = false;
        for (const [terminalId, task] of next) {
          if (task.queueId === event.queueId) {
            found = true;
            console.log(`[AutoPilot] Completing task "${task.taskTitle}" (queue: ${event.queueId})`);
            // Update task status to in_review
            updateTaskStatus(task.taskId, 'in_review');
            next.delete(terminalId);
            // Reset executing flag to allow next task
            isExecutingRef.current = false;
            break;
          }
        }
        if (!found) {
          console.log('[AutoPilot] Queue completed but not tracked by AutoPilot:', event.queueId);
        }
        return next;
      });
    },
    onQueueFailed: (event: QueueEvent) => {
      console.log('[AutoPilot] Queue failed:', event.queueId, event.reason);
      // Remove from executing tasks but keep task in original status (for retry)
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
      // Remove from executing tasks but keep task in original status (for retry)
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
  }), [updateTaskStatus]);

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

  // Auto-execute when enabled and terminals become available (debounced)
  useEffect(() => {
    if (!enabled) return;

    // Clear any pending debounce
    if (executeDebounceRef.current) {
      clearTimeout(executeDebounceRef.current);
    }

    // Check if we can execute
    const available = getAvailableTerminals();
    const executingIds = new Set(Array.from(executingTasks.values()).map(t => t.taskId));
    const hasTasksToExecute = availableTasks.some(t => !executingIds.has(t.id));

    if ((available.length > 0 || createdTerminalsCount.current < MAX_AUTO_TERMINALS) && hasTasksToExecute) {
      // Debounce to prevent rapid execution
      executeDebounceRef.current = setTimeout(() => {
        executeNextTask();
      }, 500);
    }

    return () => {
      if (executeDebounceRef.current) {
        clearTimeout(executeDebounceRef.current);
      }
    };
  }, [enabled, executingTasks, availableTasks, getAvailableTerminals, executeNextTask]);

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const newValue = !prev;
      if (!newValue) {
        // Reset execution state when disabling
        isExecutingRef.current = false;
        createdTerminalsCount.current = 0;
        updatedTasksRef.current.clear();
        if (executeDebounceRef.current) {
          clearTimeout(executeDebounceRef.current);
          executeDebounceRef.current = null;
        }
      }
      return newValue;
    });
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
