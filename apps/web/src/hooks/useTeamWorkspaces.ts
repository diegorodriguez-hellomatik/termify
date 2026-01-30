'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamWorkspacesApi, TeamWorkspace, WorkspaceLayout } from '@/lib/api';

export function useTeamWorkspaces(teamId: string) {
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamWorkspacesApi.list(teamId, session.accessToken);
      if (response.success && response.data) {
        setWorkspaces(response.data.workspaces);
      } else {
        setError(response.error as string || 'Failed to fetch workspaces');
      }
    } catch (err) {
      setError('Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const shareWorkspace = useCallback(
    async (workspaceId: string, isTeamDefault: boolean = false) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamWorkspacesApi.share(
          teamId,
          { workspaceId, isTeamDefault },
          session.accessToken
        );
        if (response.success && response.data) {
          setWorkspaces((prev) => [response.data!, ...prev]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to share workspace' };
      }
    },
    [session?.accessToken, teamId]
  );

  const updateWorkspace = useCallback(
    async (
      workspaceId: string,
      data: { layout?: WorkspaceLayout | null; isTeamDefault?: boolean }
    ) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamWorkspacesApi.update(
          teamId,
          workspaceId,
          data,
          session.accessToken
        );
        if (response.success && response.data) {
          setWorkspaces((prev) =>
            prev.map((w) => (w.id === workspaceId ? { ...w, ...response.data } : w))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update workspace' };
      }
    },
    [session?.accessToken, teamId]
  );

  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamWorkspacesApi.remove(teamId, workspaceId, session.accessToken);
        if (response.success) {
          setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to remove workspace' };
      }
    },
    [session?.accessToken, teamId]
  );

  const createWorkspace = useCallback(
    async (data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      isTeamDefault?: boolean;
    }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamWorkspacesApi.create(teamId, data, session.accessToken);
        if (response.success && response.data) {
          setWorkspaces((prev) => [response.data!, ...prev]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create workspace' };
      }
    },
    [session?.accessToken, teamId]
  );

  const defaultWorkspace = workspaces.find((w) => w.isTeamDefault);

  return {
    workspaces,
    defaultWorkspace,
    loading,
    error,
    refetch: fetchWorkspaces,
    shareWorkspace,
    createWorkspace,
    updateWorkspace,
    removeWorkspace,
  };
}
