'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { teamPresenceApi, TeamPresence, TeamNotificationPrefs } from '@/lib/api';

export function useTeamPresence(teamId: string) {
  const { data: session } = useSession();
  const [presence, setPresence] = useState<TeamPresence[]>([]);
  const [stats, setStats] = useState<{
    memberCount: number;
    activeTasks: number;
    activeTerminals: number;
    commandsLast24h: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPresence = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    try {
      const response = await teamPresenceApi.get(teamId, session.accessToken);
      if (response.success && response.data) {
        setPresence(response.data.presence);
        setStats(response.data.stats);
        setError(null);
      } else {
        setError(response.error as string || 'Failed to fetch presence');
      }
    } catch (err) {
      setError('Failed to fetch presence');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchPresence();

    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchPresence, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPresence]);

  const updatePresence = useCallback(
    (updatedPresence: TeamPresence) => {
      setPresence((prev) => {
        const index = prev.findIndex((p) => p.userId === updatedPresence.userId);
        if (index >= 0) {
          const newList = [...prev];
          newList[index] = updatedPresence;
          return newList;
        }
        return [...prev, updatedPresence];
      });
    },
    []
  );

  const removePresence = useCallback((userId: string) => {
    setPresence((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  return {
    presence,
    stats,
    loading,
    error,
    refetch: fetchPresence,
    updatePresence,
    removePresence,
    onlineCount: presence.length,
  };
}

export function useTeamNotificationPrefs(teamId: string) {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<TeamNotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await teamPresenceApi.getNotificationPrefs(teamId, session.accessToken);
      if (response.success && response.data) {
        setPrefs(response.data);
      } else {
        setError(response.error as string || 'Failed to fetch notification preferences');
      }
    } catch (err) {
      setError('Failed to fetch notification preferences');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePrefs = useCallback(
    async (data: Partial<TeamNotificationPrefs>) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamPresenceApi.updateNotificationPrefs(
          teamId,
          data,
          session.accessToken
        );
        if (response.success && response.data) {
          setPrefs(response.data);
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update notification preferences' };
      }
    },
    [session?.accessToken, teamId]
  );

  return {
    prefs,
    loading,
    error,
    refetch: fetchPrefs,
    updatePrefs,
  };
}
