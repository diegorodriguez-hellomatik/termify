'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { personalTasksApi, PersonalTask, TaskStatus, TaskPriority, TerminalTaskQueue } from '@/lib/api';
import { usePersonalTasksSocket } from './usePersonalTasksSocket';

interface UsePersonalTasksOptions {
  workspaceId?: string | null; // undefined = all tasks, null = tasks without workspace, string = specific workspace
}

export function usePersonalTasks(options: UsePersonalTasksOptions = {}) {
  const { workspaceId } = options;
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket callbacks for real-time updates
  const socketCallbacks = useMemo(() => ({
    onTaskCreated: (task: PersonalTask) => {
      setTasks((prev) => {
        // Check if task already exists (avoid duplicates)
        if (prev.some((t) => t.id === task.id)) return prev;
        // Check if task matches current workspace filter
        if (workspaceId === undefined) {
          // All tasks mode - add it
          return [...prev, task];
        } else if (workspaceId === null) {
          // Independent tasks mode - only add if no workspace
          if (task.workspaceId === null) {
            return [...prev, task];
          }
          return prev;
        } else {
          // Specific workspace mode
          if (task.workspaceId === workspaceId) {
            return [...prev, task];
          }
          return prev;
        }
      });
    },
    onTaskUpdated: (task: PersonalTask, previousStatus?: string) => {
      setTasks((prev) => {
        const index = prev.findIndex((t) => t.id === task.id);
        if (index === -1) {
          // Task not in list - might need to add if it matches filter now
          if (workspaceId === undefined) {
            return [...prev, task];
          } else if (workspaceId === null && task.workspaceId === null) {
            return [...prev, task];
          } else if (task.workspaceId === workspaceId) {
            return [...prev, task];
          }
          return prev;
        }
        // Update existing task
        const updated = [...prev];
        updated[index] = { ...updated[index], ...task };
        return updated;
      });
    },
    onTaskDeleted: (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    onTasksReordered: (reorderedTasks: PersonalTask[], status: string) => {
      setTasks((prev) => {
        // Update positions for reordered tasks
        const taskMap = new Map(reorderedTasks.map((t) => [t.id, t]));
        return prev.map((task) => {
          const updated = taskMap.get(task.id);
          if (updated) {
            return { ...task, position: updated.position, status: updated.status };
          }
          return task;
        });
      });
    },
  }), [workspaceId]);

  // Connect to WebSocket for real-time updates
  usePersonalTasksSocket({
    token: accessToken || null,
    callbacks: socketCallbacks,
  });

  const fetchTasks = useCallback(async () => {
    if (!accessToken) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await personalTasksApi.list(accessToken, workspaceId);
      if (response.success && response.data) {
        setTasks(response.data.tasks);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('[usePersonalTasks] Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId]);

  const createTask = useCallback(async (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
    commands?: string[] | null;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await personalTasksApi.create(data, accessToken);
      if (response.success && response.data) {
        setTasks((prev) => [...prev, response.data!]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[usePersonalTasks] Error creating task:', err);
      return null;
    }
  }, [accessToken]);

  const updateTask = useCallback(async (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    position?: number;
    dueDate?: string | null;
    workspaceId?: string | null;
    commands?: string[] | null;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await personalTasksApi.update(id, data, accessToken);
      if (response.success && response.data) {
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? { ...task, ...response.data } : task))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[usePersonalTasks] Error updating task:', err);
      return null;
    }
  }, [accessToken]);

  const deleteTask = useCallback(async (id: string) => {
    if (!accessToken) return false;

    try {
      const response = await personalTasksApi.delete(id, accessToken);
      if (response.success) {
        setTasks((prev) => prev.filter((task) => task.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[usePersonalTasks] Error deleting task:', err);
      return false;
    }
  }, [accessToken]);

  const reorderTasks = useCallback(async (taskIds: string[], status: TaskStatus) => {
    if (!accessToken) return false;

    try {
      const response = await personalTasksApi.reorder({ taskIds, status }, accessToken);
      if (response.success) {
        // Update local state with new positions
        setTasks((prev) => {
          const updated = [...prev];
          taskIds.forEach((id, index) => {
            const taskIndex = updated.findIndex((t) => t.id === id);
            if (taskIndex !== -1) {
              updated[taskIndex] = { ...updated[taskIndex], position: index, status };
            }
          });
          return updated;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[usePersonalTasks] Error reordering tasks:', err);
      return false;
    }
  }, [accessToken]);

  const executeTask = useCallback(async (id: string, terminalId: string): Promise<{ task: PersonalTask; queue: TerminalTaskQueue } | null> => {
    if (!accessToken) return null;

    try {
      const response = await personalTasksApi.execute(id, { terminalId }, accessToken);
      if (response.success && response.data) {
        // Update the task in local state
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? response.data!.task : task))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[usePersonalTasks] Error executing task:', err);
      return null;
    }
  }, [accessToken]);

  // Get tasks grouped by status (using lowercase keys to match DB)
  const tasksByStatus = useCallback(() => {
    const grouped: Record<string, PersonalTask[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };

    tasks.forEach((task) => {
      const statusKey = task.status.toLowerCase();
      if (!grouped[statusKey]) {
        grouped[statusKey] = [];
      }
      grouped[statusKey].push(task);
    });

    // Sort by position within each status
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks]);

  // Fetch tasks on mount or when workspaceId changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    executeTask,
    tasksByStatus,
  };
}
