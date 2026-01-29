'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamServersApi, TeamServer, ServerAuthMethod } from '@/lib/api';

export function useTeamServers(teamId: string) {
  const { data: session } = useSession();
  const [servers, setServers] = useState<TeamServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamServersApi.list(teamId, session.accessToken);
      if (response.success && response.data) {
        setServers(response.data.servers);
      } else {
        setError(response.error as string || 'Failed to fetch servers');
      }
    } catch (err) {
      setError('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const createServer = useCallback(
    async (data: {
      name: string;
      host: string;
      port?: number;
      username?: string;
      authMethod?: ServerAuthMethod;
      description?: string;
      documentation?: string;
      tags?: string[];
    }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamServersApi.create(teamId, data, session.accessToken);
        if (response.success && response.data) {
          setServers((prev) => [response.data!, ...prev]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create server' };
      }
    },
    [session?.accessToken, teamId]
  );

  const updateServer = useCallback(
    async (
      serverId: string,
      data: {
        name?: string;
        host?: string;
        port?: number;
        username?: string;
        authMethod?: ServerAuthMethod;
        description?: string | null;
        documentation?: string | null;
        tags?: string[];
      }
    ) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamServersApi.update(teamId, serverId, data, session.accessToken);
        if (response.success && response.data) {
          setServers((prev) =>
            prev.map((s) => (s.id === serverId ? response.data! : s))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update server' };
      }
    },
    [session?.accessToken, teamId]
  );

  const deleteServer = useCallback(
    async (serverId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamServersApi.delete(teamId, serverId, session.accessToken);
        if (response.success) {
          setServers((prev) => prev.filter((s) => s.id !== serverId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to delete server' };
      }
    },
    [session?.accessToken, teamId]
  );

  const checkServer = useCallback(
    async (serverId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamServersApi.check(teamId, serverId, session.accessToken);
        if (response.success && response.data) {
          setServers((prev) =>
            prev.map((s) =>
              s.id === serverId
                ? {
                    ...s,
                    lastStatus: response.data!.status,
                    lastCheckedAt: response.data!.checkedAt,
                  }
                : s
            )
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to check server' };
      }
    },
    [session?.accessToken, teamId]
  );

  const connectToServer = useCallback(
    async (serverId: string, credentials: { password?: string; privateKey?: string }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamServersApi.connect(
          teamId,
          serverId,
          credentials,
          session.accessToken
        );
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to connect to server' };
      }
    },
    [session?.accessToken, teamId]
  );

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
    createServer,
    updateServer,
    deleteServer,
    checkServer,
    connectToServer,
  };
}
