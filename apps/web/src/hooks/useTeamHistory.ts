'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamHistoryApi, teamAuditLogsApi, TeamCommandHistory, TeamAuditLog } from '@/lib/api';

export function useTeamHistory(teamId: string) {
  const { data: session } = useSession();
  const [history, setHistory] = useState<TeamCommandHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (params?: {
      search?: string;
      userId?: string;
      terminalId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      if (!session?.accessToken || !teamId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await teamHistoryApi.list(teamId, session.accessToken, params);
        if (response.success && response.data) {
          setHistory(response.data.history);
          setTotal(response.data.total);
        } else {
          setError(response.error as string || 'Failed to fetch history');
        }
      } catch (err) {
        setError('Failed to fetch history');
      } finally {
        setLoading(false);
      }
    },
    [session?.accessToken, teamId]
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchStats = useCallback(async () => {
    if (!session?.accessToken || !teamId) return null;

    try {
      const response = await teamHistoryApi.stats(teamId, session.accessToken);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      return null;
    }
  }, [session?.accessToken, teamId]);

  return {
    history,
    total,
    loading,
    error,
    refetch: fetchHistory,
    fetchStats,
  };
}

export function useTeamAuditLogs(teamId: string) {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<TeamAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (params?: {
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      if (!session?.accessToken || !teamId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await teamAuditLogsApi.list(teamId, session.accessToken, params);
        if (response.success && response.data) {
          setLogs(response.data.logs);
          setTotal(response.data.total);
        } else {
          setError(response.error as string || 'Failed to fetch audit logs');
        }
      } catch (err) {
        setError('Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    },
    [session?.accessToken, teamId]
  );

  const fetchActions = useCallback(async () => {
    if (!session?.accessToken || !teamId) return;

    try {
      const response = await teamAuditLogsApi.actions(teamId, session.accessToken);
      if (response.success && response.data) {
        setActions(response.data.actions);
      }
    } catch (err) {
      // Ignore
    }
  }, [session?.accessToken, teamId]);

  useEffect(() => {
    fetchLogs();
    fetchActions();
  }, [fetchLogs, fetchActions]);

  return {
    logs,
    total,
    actions,
    loading,
    error,
    refetch: fetchLogs,
  };
}
