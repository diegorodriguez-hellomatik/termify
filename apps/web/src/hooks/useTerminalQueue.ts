'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  terminalQueueApi,
  TerminalTaskQueue,
  TerminalQueueCommand,
  QueueStatus,
  CommandStatus,
} from '@/lib/api';

export type { TerminalTaskQueue, TerminalQueueCommand, QueueStatus, CommandStatus };

interface UseTerminalQueueOptions {
  terminalId: string;
  onQueueCompleted?: (queue: TerminalTaskQueue) => void;
  onQueueFailed?: (queue: TerminalTaskQueue, reason: string) => void;
}

export function useTerminalQueue({
  terminalId,
  onQueueCompleted,
  onQueueFailed,
}: UseTerminalQueueOptions) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const [queues, setQueues] = useState<TerminalTaskQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch queues
  const fetchQueues = useCallback(async () => {
    if (!token || !terminalId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await terminalQueueApi.list(terminalId, token);
      if (response.success && response.data) {
        setQueues(response.data.queues);
      } else {
        setError(response.error as string || 'Failed to fetch queues');
      }
    } catch (err) {
      console.error('Error fetching queues:', err);
      setError('Failed to fetch queues');
    } finally {
      setLoading(false);
    }
  }, [terminalId, token]);

  // Create queue
  const createQueue = useCallback(
    async (
      name: string,
      commands: Array<{ command: string; position?: number }>
    ): Promise<TerminalTaskQueue | null> => {
      if (!token) return null;

      try {
        const response = await terminalQueueApi.create(
          terminalId,
          { name, commands },
          token
        );
        if (response.success && response.data) {
          setQueues((prev) => [...prev, response.data!.queue]);
          return response.data.queue;
        } else {
          setError(response.error as string || 'Failed to create queue');
          return null;
        }
      } catch (err) {
        console.error('Error creating queue:', err);
        setError('Failed to create queue');
        return null;
      }
    },
    [terminalId, token]
  );

  // Delete queue
  const deleteQueue = useCallback(
    async (queueId: string): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = await terminalQueueApi.delete(terminalId, queueId, token);
        if (response.success) {
          setQueues((prev) => prev.filter((q) => q.id !== queueId));
          return true;
        } else {
          setError(response.error as string || 'Failed to delete queue');
          return false;
        }
      } catch (err) {
        console.error('Error deleting queue:', err);
        setError('Failed to delete queue');
        return false;
      }
    },
    [terminalId, token]
  );

  // Start queue execution
  const startQueue = useCallback(
    async (queueId: string): Promise<TerminalTaskQueue | null> => {
      if (!token) return null;

      try {
        const response = await terminalQueueApi.start(terminalId, queueId, token);
        if (response.success && response.data) {
          setQueues((prev) =>
            prev.map((q) => (q.id === queueId ? response.data!.queue : q))
          );
          return response.data.queue;
        } else {
          setError(response.error as string || 'Failed to start queue');
          return null;
        }
      } catch (err) {
        console.error('Error starting queue:', err);
        setError('Failed to start queue');
        return null;
      }
    },
    [terminalId, token]
  );

  // Cancel queue execution
  const cancelQueue = useCallback(
    async (queueId: string): Promise<TerminalTaskQueue | null> => {
      if (!token) return null;

      try {
        const response = await terminalQueueApi.cancel(terminalId, queueId, token);
        if (response.success && response.data) {
          setQueues((prev) =>
            prev.map((q) => (q.id === queueId ? response.data!.queue : q))
          );
          return response.data.queue;
        } else {
          setError(response.error as string || 'Failed to cancel queue');
          return null;
        }
      } catch (err) {
        console.error('Error cancelling queue:', err);
        setError('Failed to cancel queue');
        return null;
      }
    },
    [terminalId, token]
  );

  // Reorder queues
  const reorderQueues = useCallback(
    async (queueIds: string[]): Promise<boolean> => {
      if (!token) return false;

      try {
        const response = await terminalQueueApi.reorder(terminalId, queueIds, token);
        if (response.success) {
          // Optimistically reorder local state
          setQueues((prev) => {
            const queueMap = new Map(prev.map((q) => [q.id, q]));
            return queueIds
              .map((id, index) => {
                const queue = queueMap.get(id);
                if (queue) {
                  return { ...queue, position: index };
                }
                return null;
              })
              .filter(Boolean) as TerminalTaskQueue[];
          });
          return true;
        } else {
          setError(response.error as string || 'Failed to reorder queues');
          return false;
        }
      } catch (err) {
        console.error('Error reordering queues:', err);
        setError('Failed to reorder queues');
        return false;
      }
    },
    [terminalId, token]
  );

  // Update queue from WebSocket event
  const handleQueueUpdate = useCallback((updatedQueue: TerminalTaskQueue) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === updatedQueue.id ? updatedQueue : q))
    );
  }, []);

  // Handle queue created event
  const handleQueueCreated = useCallback((queue: TerminalTaskQueue) => {
    setQueues((prev) => {
      // Avoid duplicates
      if (prev.some((q) => q.id === queue.id)) {
        return prev;
      }
      return [...prev, queue];
    });
  }, []);

  // Handle queue deleted event
  const handleQueueDeleted = useCallback((queueId: string) => {
    setQueues((prev) => prev.filter((q) => q.id !== queueId));
  }, []);

  // Handle command started event
  const handleCommandStarted = useCallback(
    (queueId: string, commandId: string) => {
      setQueues((prev) =>
        prev.map((q) => {
          if (q.id !== queueId) return q;
          return {
            ...q,
            commands: q.commands.map((cmd) =>
              cmd.id === commandId
                ? { ...cmd, status: 'RUNNING' as CommandStatus }
                : cmd
            ),
          };
        })
      );
    },
    []
  );

  // Handle command completed event
  const handleCommandCompleted = useCallback(
    (queueId: string, commandId: string, exitCode: number) => {
      setQueues((prev) =>
        prev.map((q) => {
          if (q.id !== queueId) return q;
          return {
            ...q,
            commands: q.commands.map((cmd) =>
              cmd.id === commandId
                ? {
                    ...cmd,
                    status: (exitCode === 0 ? 'COMPLETED' : 'FAILED') as CommandStatus,
                    exitCode,
                    completedAt: new Date().toISOString(),
                  }
                : cmd
            ),
          };
        })
      );
    },
    []
  );

  // Handle queue completed event
  const handleQueueCompleted = useCallback(
    (queueId: string) => {
      setQueues((prev) =>
        prev.map((q) => {
          if (q.id !== queueId) return q;
          const updated = {
            ...q,
            status: 'COMPLETED' as QueueStatus,
            completedAt: new Date().toISOString(),
          };
          onQueueCompleted?.(updated);
          return updated;
        })
      );
    },
    [onQueueCompleted]
  );

  // Handle queue failed event
  const handleQueueFailed = useCallback(
    (queueId: string, reason: string) => {
      setQueues((prev) =>
        prev.map((q) => {
          if (q.id !== queueId) return q;
          const updated = {
            ...q,
            status: 'FAILED' as QueueStatus,
            completedAt: new Date().toISOString(),
          };
          onQueueFailed?.(updated, reason);
          return updated;
        })
      );
    },
    [onQueueFailed]
  );

  // Handle queue cancelled event
  const handleQueueCancelled = useCallback((queueId: string) => {
    setQueues((prev) =>
      prev.map((q) => {
        if (q.id !== queueId) return q;
        return {
          ...q,
          status: 'CANCELLED' as QueueStatus,
          completedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  // Get currently running queue
  const runningQueue = queues.find((q) => q.status === 'RUNNING');

  // Get pending queues
  const pendingQueues = queues.filter((q) => q.status === 'PENDING');

  // Get completed queues
  const completedQueues = queues.filter(
    (q) => q.status === 'COMPLETED' || q.status === 'FAILED' || q.status === 'CANCELLED'
  );

  // Initial fetch
  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  return {
    queues,
    runningQueue,
    pendingQueues,
    completedQueues,
    loading,
    error,
    fetchQueues,
    createQueue,
    deleteQueue,
    startQueue,
    cancelQueue,
    reorderQueues,
    // WebSocket event handlers
    handleQueueUpdate,
    handleQueueCreated,
    handleQueueDeleted,
    handleCommandStarted,
    handleCommandCompleted,
    handleQueueCompleted,
    handleQueueFailed,
    handleQueueCancelled,
  };
}
