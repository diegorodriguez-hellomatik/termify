'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { personalTasksApi, PersonalTask, TaskStatus, TaskPriority, TerminalTaskQueue } from '@/lib/api';

interface UsePersonalTasksOptions {
  boardId?: string | null; // undefined = all tasks, null = tasks without board, string = specific board
}

export function usePersonalTasks(options: UsePersonalTasksOptions = {}) {
  const { boardId } = options;
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!accessToken) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await personalTasksApi.list(accessToken, boardId);
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
  }, [accessToken, boardId]);

  const createTask = useCallback(async (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    boardId?: string | null;
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
    boardId?: string | null;
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

  // Get tasks grouped by status
  const tasksByStatus = useCallback(() => {
    const grouped: Record<TaskStatus, PersonalTask[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    // Sort by position within each status
    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks]);

  // Fetch tasks on mount or when boardId changes
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
