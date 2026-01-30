'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamsApi, Team, TeamMember } from '@/lib/api';

export function useTeams() {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamsApi.list(accessToken);
      if (response.success && response.data) {
        setTeams(response.data.teams);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch teams');
      }
    } catch (err) {
      setError('Failed to fetch teams');
      console.error('[useTeams] Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const getTeam = useCallback(async (id: string) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.get(id, accessToken);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error fetching team:', err);
      return null;
    }
  }, [accessToken]);

  const createTeam = useCallback(async (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.create(data, accessToken);
      if (response.success && response.data) {
        setTeams((prev) => [...prev, response.data!]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error creating team:', err);
      return null;
    }
  }, [accessToken]);

  const updateTeam = useCallback(async (id: string, data: {
    name?: string;
    description?: string | null;
    color?: string;
    icon?: string | null;
    image?: string | null;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.update(id, data, accessToken);
      if (response.success && response.data) {
        setTeams((prev) =>
          prev.map((team) => (team.id === id ? { ...team, ...response.data } : team))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error updating team:', err);
      return null;
    }
  }, [accessToken]);

  const uploadTeamImage = useCallback(async (teamId: string, file: File) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.uploadImage(teamId, file, accessToken);
      if (response.success && response.data) {
        // Update team with new image URL
        setTeams((prev) =>
          prev.map((team) => (team.id === teamId ? { ...team, image: response.data!.url } : team))
        );
        return response.data.url;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error uploading team image:', err);
      return null;
    }
  }, [accessToken]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!accessToken) return false;

    try {
      const response = await teamsApi.delete(id, accessToken);
      if (response.success) {
        setTeams((prev) => prev.filter((team) => team.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useTeams] Error deleting team:', err);
      return false;
    }
  }, [accessToken]);

  const inviteMember = useCallback(async (teamId: string, data: {
    email: string;
    role?: 'ADMIN' | 'MEMBER';
  }) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.invite(teamId, data, accessToken);
      if (response.success && response.data) {
        // Update team member count
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId ? { ...team, memberCount: team.memberCount + 1 } : team
          )
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error inviting member:', err);
      return null;
    }
  }, [accessToken]);

  const updateMemberRole = useCallback(async (
    teamId: string,
    memberId: string,
    role: 'ADMIN' | 'MEMBER'
  ) => {
    if (!accessToken) return null;

    try {
      const response = await teamsApi.updateMemberRole(teamId, memberId, { role }, accessToken);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[useTeams] Error updating member role:', err);
      return null;
    }
  }, [accessToken]);

  const removeMember = useCallback(async (teamId: string, memberId: string) => {
    if (!accessToken) return false;

    try {
      const response = await teamsApi.removeMember(teamId, memberId, accessToken);
      if (response.success) {
        // Update team member count
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId ? { ...team, memberCount: Math.max(0, team.memberCount - 1) } : team
          )
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useTeams] Error removing member:', err);
      return false;
    }
  }, [accessToken]);

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    loading,
    error,
    fetchTeams,
    getTeam,
    createTeam,
    updateTeam,
    uploadTeamImage,
    deleteTeam,
    inviteMember,
    updateMemberRole,
    removeMember,
  };
}
