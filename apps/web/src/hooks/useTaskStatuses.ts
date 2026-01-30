'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { taskStatusApi, TaskStatusConfig } from '@/lib/api';

interface UseTaskStatusesReturn {
  statuses: TaskStatusConfig[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createStatus: (data: {
    key: string;
    name: string;
    color: string;
    position?: number;
  }) => Promise<TaskStatusConfig | null>;
  updateStatus: (id: string, data: {
    name?: string;
    color?: string;
    position?: number;
  }) => Promise<TaskStatusConfig | null>;
  deleteStatus: (id: string, moveToStatusId?: string) => Promise<boolean>;
  reorderStatuses: (statusIds: string[]) => Promise<boolean>;
}

const DEFAULT_STATUSES: TaskStatusConfig[] = [
  { id: 'default-backlog', key: 'backlog', name: 'Backlog', color: '#6B7280', position: 0, userId: null, teamId: null, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'default-todo', key: 'todo', name: 'To Do', color: '#3B82F6', position: 1, userId: null, teamId: null, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'default-in_progress', key: 'in_progress', name: 'In Progress', color: '#F59E0B', position: 2, userId: null, teamId: null, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'default-in_review', key: 'in_review', name: 'In Review', color: '#8B5CF6', position: 3, userId: null, teamId: null, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'default-done', key: 'done', name: 'Done', color: '#22C55E', position: 4, userId: null, teamId: null, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export function useTaskStatuses(): UseTaskStatusesReturn {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [statuses, setStatuses] = useState<TaskStatusConfig[]>(DEFAULT_STATUSES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatuses = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await taskStatusApi.list(accessToken);
      if (response.success && response.data?.statuses && response.data.statuses.length > 0) {
        setStatuses(response.data.statuses.sort((a, b) => a.position - b.position));
      } else {
        setStatuses(DEFAULT_STATUSES);
      }
    } catch (err) {
      console.error('Failed to fetch task statuses:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch statuses'));
      setStatuses(DEFAULT_STATUSES);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const createStatus = useCallback(async (data: {
    key: string;
    name: string;
    color: string;
    position?: number;
  }): Promise<TaskStatusConfig | null> => {
    if (!accessToken) return null;

    try {
      const result = await taskStatusApi.create(data, accessToken);
      await fetchStatuses();
      return result.success && result.data ? result.data : null;
    } catch (err) {
      console.error('Failed to create status:', err);
      return null;
    }
  }, [accessToken, fetchStatuses]);

  const updateStatus = useCallback(async (id: string, data: {
    name?: string;
    color?: string;
    position?: number;
  }): Promise<TaskStatusConfig | null> => {
    if (!accessToken) return null;

    try {
      const result = await taskStatusApi.update(id, data, accessToken);
      await fetchStatuses();
      return result.success && result.data ? result.data : null;
    } catch (err) {
      console.error('Failed to update status:', err);
      return null;
    }
  }, [accessToken, fetchStatuses]);

  const deleteStatus = useCallback(async (id: string, moveToStatusId?: string): Promise<boolean> => {
    if (!accessToken) return false;

    try {
      await taskStatusApi.delete(id, moveToStatusId, accessToken);
      await fetchStatuses();
      return true;
    } catch (err) {
      console.error('Failed to delete status:', err);
      return false;
    }
  }, [accessToken, fetchStatuses]);

  const reorderStatuses = useCallback(async (statusIds: string[]): Promise<boolean> => {
    if (!accessToken) return false;

    try {
      // Update positions for each status
      await Promise.all(
        statusIds.map((id, index) =>
          taskStatusApi.update(id, { position: index }, accessToken)
        )
      );
      await fetchStatuses();
      return true;
    } catch (err) {
      console.error('Failed to reorder statuses:', err);
      return false;
    }
  }, [accessToken, fetchStatuses]);

  return {
    statuses,
    isLoading,
    error,
    refetch: fetchStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  };
}
