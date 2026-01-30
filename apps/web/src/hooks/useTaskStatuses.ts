import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { taskStatusApi, teamTaskStatusApi, TaskStatusConfig } from '@/lib/api';

interface UseTaskStatusesOptions {
  teamId?: string;
}

interface UseTaskStatusesReturn {
  statuses: TaskStatusConfig[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createStatus: (data: {
    key: string;
    name: string;
    color: string;
    position?: number;
    isDefault?: boolean;
  }) => Promise<TaskStatusConfig | null>;
  updateStatus: (
    statusId: string,
    data: {
      name?: string;
      color?: string;
      position?: number;
      isDefault?: boolean;
    }
  ) => Promise<TaskStatusConfig | null>;
  deleteStatus: (statusId: string, moveToStatusId?: string) => Promise<boolean>;
  reorderStatuses: (statusIds: string[]) => Promise<boolean>;
  getStatusByKey: (key: string) => TaskStatusConfig | undefined;
  getDefaultStatus: () => TaskStatusConfig | undefined;
}

export function useTaskStatuses(options: UseTaskStatusesOptions = {}): UseTaskStatusesReturn {
  const { teamId } = options;
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [statuses, setStatuses] = useState<TaskStatusConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = teamId
        ? await teamTaskStatusApi.list(teamId, token)
        : await taskStatusApi.list(token);

      if (response.success && response.data) {
        setStatuses(response.data.statuses);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch statuses');
      }
    } catch (err) {
      setError('Failed to fetch statuses');
      console.error('[useTaskStatuses] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, teamId]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const createStatus = useCallback(
    async (data: {
      key: string;
      name: string;
      color: string;
      position?: number;
      isDefault?: boolean;
    }): Promise<TaskStatusConfig | null> => {
      if (!token) return null;

      try {
        const response = teamId
          ? await teamTaskStatusApi.create(teamId, data, token)
          : await taskStatusApi.create(data, token);

        if (response.success && response.data) {
          await fetchStatuses();
          return response.data;
        } else {
          setError(typeof response.error === 'string' ? response.error : 'Failed to create status');
          return null;
        }
      } catch (err) {
        setError('Failed to create status');
        console.error('[useTaskStatuses] Create error:', err);
        return null;
      }
    },
    [token, teamId, fetchStatuses]
  );

  const updateStatus = useCallback(
    async (
      statusId: string,
      data: {
        name?: string;
        color?: string;
        position?: number;
        isDefault?: boolean;
      }
    ): Promise<TaskStatusConfig | null> => {
      if (!token) return null;

      try {
        const response = teamId
          ? await teamTaskStatusApi.update(teamId, statusId, data, token)
          : await taskStatusApi.update(statusId, data, token);

        if (response.success && response.data) {
          await fetchStatuses();
          return response.data;
        } else {
          setError(typeof response.error === 'string' ? response.error : 'Failed to update status');
          return null;
        }
      } catch (err) {
        setError('Failed to update status');
        console.error('[useTaskStatuses] Update error:', err);
        return null;
      }
    },
    [token, teamId, fetchStatuses]
  );

  const deleteStatus = useCallback(
    async (statusId: string, moveToStatusId?: string): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = teamId
          ? await teamTaskStatusApi.delete(teamId, statusId, moveToStatusId, token)
          : await taskStatusApi.delete(statusId, moveToStatusId, token);

        if (response.success) {
          await fetchStatuses();
          return true;
        } else {
          setError(typeof response.error === 'string' ? response.error : 'Failed to delete status');
          return false;
        }
      } catch (err) {
        setError('Failed to delete status');
        console.error('[useTaskStatuses] Delete error:', err);
        return false;
      }
    },
    [token, teamId, fetchStatuses]
  );

  const reorderStatuses = useCallback(
    async (statusIds: string[]): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = teamId
          ? await teamTaskStatusApi.reorder(teamId, statusIds, token)
          : await taskStatusApi.reorder(statusIds, token);

        if (response.success) {
          await fetchStatuses();
          return true;
        } else {
          setError(typeof response.error === 'string' ? response.error : 'Failed to reorder statuses');
          return false;
        }
      } catch (err) {
        setError('Failed to reorder statuses');
        console.error('[useTaskStatuses] Reorder error:', err);
        return false;
      }
    },
    [token, teamId, fetchStatuses]
  );

  const getStatusByKey = useCallback(
    (key: string): TaskStatusConfig | undefined => {
      return statuses.find((s) => s.key === key);
    },
    [statuses]
  );

  const getDefaultStatus = useCallback((): TaskStatusConfig | undefined => {
    return statuses.find((s) => s.isDefault) || statuses[0];
  }, [statuses]);

  return {
    statuses,
    isLoading,
    error,
    refetch: fetchStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    getStatusByKey,
    getDefaultStatus,
  };
}
