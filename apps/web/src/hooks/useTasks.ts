'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { tasksApi, Task, TaskStatus, TaskPriority, TaskAssignee } from '@/lib/api';

export function useTasks(teamId: string | null) {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!accessToken || !teamId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await tasksApi.list(teamId, accessToken);
      if (response.success && response.data) {
        setTasks(response.data.tasks);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error('[useTasks] Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, teamId]);

  const getTask = useCallback(async (id: string) => {
    if (!accessToken) return null;

    try {
      const response = await tasksApi.get(id, accessToken);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTasks] Error fetching task:', err);
      return null;
    }
  }, [accessToken]);

  const createTask = useCallback(async (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
  }) => {
    if (!accessToken || !teamId) return null;

    try {
      const response = await tasksApi.create({ ...data, teamId }, accessToken);
      if (response.success && response.data) {
        setTasks((prev) => [...prev, response.data!]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTasks] Error creating task:', err);
      return null;
    }
  }, [accessToken, teamId]);

  const updateTask = useCallback(async (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    position?: number;
    dueDate?: string | null;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await tasksApi.update(id, data, accessToken);
      if (response.success && response.data) {
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? { ...task, ...response.data } : task))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTasks] Error updating task:', err);
      return null;
    }
  }, [accessToken]);

  const deleteTask = useCallback(async (id: string) => {
    if (!accessToken) return false;

    try {
      const response = await tasksApi.delete(id, accessToken);
      if (response.success) {
        setTasks((prev) => prev.filter((task) => task.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useTasks] Error deleting task:', err);
      return false;
    }
  }, [accessToken]);

  const assignTask = useCallback(async (taskId: string, teamMemberId: string) => {
    if (!accessToken) return null;

    try {
      const response = await tasksApi.assign(taskId, teamMemberId, accessToken);
      if (response.success && response.data) {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id === taskId) {
              return {
                ...task,
                assignees: [...(task.assignees || []), response.data!],
              };
            }
            return task;
          })
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTasks] Error assigning task:', err);
      return null;
    }
  }, [accessToken]);

  const unassignTask = useCallback(async (taskId: string, assigneeId: string) => {
    if (!accessToken) return false;

    try {
      const response = await tasksApi.unassign(taskId, assigneeId, accessToken);
      if (response.success) {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id === taskId) {
              return {
                ...task,
                assignees: (task.assignees || []).filter((a) => a.id !== assigneeId),
              };
            }
            return task;
          })
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useTasks] Error unassigning task:', err);
      return false;
    }
  }, [accessToken]);

  const reorderTasks = useCallback(async (taskIds: string[], status: TaskStatus) => {
    if (!accessToken) return false;

    try {
      const response = await tasksApi.reorder({ taskIds, status }, accessToken);
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
      console.error('[useTasks] Error reordering tasks:', err);
      return false;
    }
  }, [accessToken]);

  // Get tasks grouped by status
  const tasksByStatus = useCallback(() => {
    const grouped: Record<TaskStatus, Task[]> = {
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

  // Handle WebSocket updates
  const handleTaskCreated = useCallback((task: Task) => {
    if (task.teamId === teamId) {
      setTasks((prev) => {
        // Check if task already exists
        if (prev.some((t) => t.id === task.id)) {
          return prev;
        }
        return [...prev, task];
      });
    }
  }, [teamId]);

  const handleTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? task : t))
    );
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleTaskStatusChanged = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  }, []);

  // Fetch tasks when teamId changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    unassignTask,
    reorderTasks,
    tasksByStatus,
    // WebSocket handlers
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskStatusChanged,
  };
}
