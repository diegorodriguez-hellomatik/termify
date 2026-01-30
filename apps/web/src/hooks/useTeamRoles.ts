'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamRolesApi, TeamCustomRole } from '@/lib/api';

export function useTeamRoles(teamId: string) {
  const { data: session } = useSession();
  const [roles, setRoles] = useState<TeamCustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamRolesApi.list(teamId, session.accessToken);
      if (response.success && response.data) {
        setRoles(response.data.roles);
      } else {
        setError(response.error as string || 'Failed to fetch roles');
      }
    } catch (err) {
      setError('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createRole = useCallback(
    async (data: {
      name: string;
      description?: string;
      color?: string;
      permissions: string[];
    }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamRolesApi.create(teamId, data, session.accessToken);
        if (response.success && response.data) {
          setRoles((prev) => [...prev, response.data!]);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create role' };
      }
    },
    [session?.accessToken, teamId]
  );

  const updateRole = useCallback(
    async (
      roleId: string,
      data: {
        name?: string;
        description?: string | null;
        color?: string;
        permissions?: string[];
        position?: number;
      }
    ) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamRolesApi.update(teamId, roleId, data, session.accessToken);
        if (response.success && response.data) {
          setRoles((prev) =>
            prev.map((r) => (r.id === roleId ? response.data! : r))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update role' };
      }
    },
    [session?.accessToken, teamId]
  );

  const deleteRole = useCallback(
    async (roleId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamRolesApi.delete(teamId, roleId, session.accessToken);
        if (response.success) {
          setRoles((prev) => prev.filter((r) => r.id !== roleId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to delete role' };
      }
    },
    [session?.accessToken, teamId]
  );

  const assignRoleToMember = useCallback(
    async (memberId: string, customRoleId: string | null) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamRolesApi.assignToMember(
          teamId,
          memberId,
          { customRoleId },
          session.accessToken
        );
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to assign role' };
      }
    },
    [session?.accessToken, teamId]
  );

  return {
    roles,
    loading,
    error,
    refetch: fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToMember,
  };
}
