'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  teamTerminalsApi,
  TeamTerminalShare,
  SharePermission,
} from '@/lib/api';

export function useTeamTerminals(teamId: string) {
  const { data: session } = useSession();
  const [terminals, setTerminals] = useState<TeamTerminalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTerminals = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamTerminalsApi.list(teamId, session.accessToken);
      if (response.success && response.data) {
        setTerminals(response.data.terminals);
      } else {
        setError(response.error as string || 'Failed to fetch terminals');
      }
    } catch (err) {
      setError('Failed to fetch terminals');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  const shareTerminal = useCallback(
    async (terminalId: string, permission: SharePermission = 'VIEW') => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamTerminalsApi.share(
          teamId,
          { terminalId, permission },
          session.accessToken
        );
        if (response.success && response.data) {
          setTerminals((prev) => [response.data!, ...prev]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to share terminal' };
      }
    },
    [session?.accessToken, teamId]
  );

  const updatePermission = useCallback(
    async (terminalId: string, permission: SharePermission) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamTerminalsApi.updatePermission(
          teamId,
          terminalId,
          { permission },
          session.accessToken
        );
        if (response.success && response.data) {
          setTerminals((prev) =>
            prev.map((t) =>
              t.terminalId === terminalId ? { ...t, permission } : t
            )
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update permission' };
      }
    },
    [session?.accessToken, teamId]
  );

  const removeTerminal = useCallback(
    async (terminalId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamTerminalsApi.remove(teamId, terminalId, session.accessToken);
        if (response.success) {
          setTerminals((prev) => prev.filter((t) => t.terminalId !== terminalId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to remove terminal' };
      }
    },
    [session?.accessToken, teamId]
  );

  const createTerminal = useCallback(
    async (data: {
      name: string;
      type?: 'LOCAL' | 'SSH';
      cols?: number;
      rows?: number;
      cwd?: string;
      categoryId?: string;
      sshHost?: string;
      sshPort?: number;
      sshUsername?: string;
    }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamTerminalsApi.create(teamId, data, session.accessToken);
        if (response.success && response.data) {
          setTerminals((prev) => [response.data!, ...prev]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create terminal' };
      }
    },
    [session?.accessToken, teamId]
  );

  return {
    terminals,
    loading,
    error,
    refetch: fetchTerminals,
    shareTerminal,
    createTerminal,
    updatePermission,
    removeTerminal,
  };
}
