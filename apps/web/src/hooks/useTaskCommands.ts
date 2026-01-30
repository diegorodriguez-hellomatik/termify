'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { taskCommandsApi, TaskCommand } from '@/lib/api';

export function useTaskCommands(taskId: string) {
  const { data: session } = useSession();
  const [commands, setCommands] = useState<TaskCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommands = useCallback(async () => {
    if (!session?.accessToken || !taskId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await taskCommandsApi.list(taskId, session.accessToken);
      if (response.success && response.data) {
        setCommands(response.data.commands);
      } else {
        setError(response.error as string || 'Failed to fetch commands');
      }
    } catch (err) {
      setError('Failed to fetch commands');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, taskId]);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  const createCommand = useCallback(
    async (data: { command: string; description?: string; position?: number }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await taskCommandsApi.create(taskId, data, session.accessToken);
        if (response.success && response.data) {
          setCommands((prev) => {
            const newList = [...prev, response.data!];
            return newList.sort((a, b) => a.position - b.position);
          });
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create command' };
      }
    },
    [session?.accessToken, taskId]
  );

  const updateCommand = useCallback(
    async (
      commandId: string,
      data: {
        command?: string;
        description?: string | null;
        position?: number;
        isCompleted?: boolean;
      }
    ) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await taskCommandsApi.update(taskId, commandId, data, session.accessToken);
        if (response.success && response.data) {
          setCommands((prev) =>
            prev.map((c) => (c.id === commandId ? response.data! : c))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update command' };
      }
    },
    [session?.accessToken, taskId]
  );

  const deleteCommand = useCallback(
    async (commandId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await taskCommandsApi.delete(taskId, commandId, session.accessToken);
        if (response.success) {
          setCommands((prev) => prev.filter((c) => c.id !== commandId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to delete command' };
      }
    },
    [session?.accessToken, taskId]
  );

  const executeCommand = useCallback(
    async (commandId: string, exitCode: number) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await taskCommandsApi.execute(
          taskId,
          commandId,
          exitCode,
          session.accessToken
        );
        if (response.success && response.data) {
          setCommands((prev) =>
            prev.map((c) => (c.id === commandId ? response.data! : c))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to execute command' };
      }
    },
    [session?.accessToken, taskId]
  );

  const reorderCommands = useCallback(
    async (commandIds: string[]) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await taskCommandsApi.reorder(taskId, commandIds, session.accessToken);
        if (response.success) {
          // Update local state with new order
          setCommands((prev) => {
            const map = new Map(prev.map((c) => [c.id, c]));
            return commandIds
              .map((id, index) => {
                const cmd = map.get(id);
                return cmd ? { ...cmd, position: index } : null;
              })
              .filter(Boolean) as TaskCommand[];
          });
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to reorder commands' };
      }
    },
    [session?.accessToken, taskId]
  );

  const toggleComplete = useCallback(
    async (commandId: string) => {
      const command = commands.find((c) => c.id === commandId);
      if (!command) return { success: false, error: 'Command not found' };

      return updateCommand(commandId, { isCompleted: !command.isCompleted });
    },
    [commands, updateCommand]
  );

  return {
    commands,
    loading,
    error,
    refetch: fetchCommands,
    createCommand,
    updateCommand,
    deleteCommand,
    executeCommand,
    reorderCommands,
    toggleComplete,
    completedCount: commands.filter((c) => c.isCompleted).length,
    totalCount: commands.length,
  };
}
