'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { teamSnippetsApi, TeamSnippet } from '@/lib/api';

export function useTeamSnippets(teamId: string) {
  const { data: session } = useSession();
  const [snippets, setSnippets] = useState<TeamSnippet[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnippets = useCallback(
    async (params?: { category?: string; search?: string }) => {
      if (!session?.accessToken || !teamId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await teamSnippetsApi.list(teamId, session.accessToken, params);
        if (response.success && response.data) {
          setSnippets(response.data.snippets);
          setCategories(response.data.categories);
        } else {
          setError(response.error as string || 'Failed to fetch snippets');
        }
      } catch (err) {
        setError('Failed to fetch snippets');
      } finally {
        setLoading(false);
      }
    },
    [session?.accessToken, teamId]
  );

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  const createSnippet = useCallback(
    async (data: {
      name: string;
      command: string;
      description?: string;
      category?: string;
      tags?: string[];
    }) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamSnippetsApi.create(teamId, data, session.accessToken);
        if (response.success && response.data) {
          setSnippets((prev) => [response.data!, ...prev]);
          if (data.category && !categories.includes(data.category)) {
            setCategories((prev) => [...prev, data.category!]);
          }
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to create snippet' };
      }
    },
    [session?.accessToken, teamId, categories]
  );

  const updateSnippet = useCallback(
    async (
      snippetId: string,
      data: {
        name?: string;
        command?: string;
        description?: string | null;
        category?: string | null;
        tags?: string[];
      }
    ) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamSnippetsApi.update(teamId, snippetId, data, session.accessToken);
        if (response.success && response.data) {
          setSnippets((prev) =>
            prev.map((s) => (s.id === snippetId ? response.data! : s))
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to update snippet' };
      }
    },
    [session?.accessToken, teamId]
  );

  const deleteSnippet = useCallback(
    async (snippetId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamSnippetsApi.delete(teamId, snippetId, session.accessToken);
        if (response.success) {
          setSnippets((prev) => prev.filter((s) => s.id !== snippetId));
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to delete snippet' };
      }
    },
    [session?.accessToken, teamId]
  );

  const useSnippet = useCallback(
    async (snippetId: string) => {
      if (!session?.accessToken) return { success: false, error: 'Not authenticated' };

      try {
        const response = await teamSnippetsApi.use(teamId, snippetId, session.accessToken);
        if (response.success && response.data) {
          setSnippets((prev) =>
            prev.map((s) =>
              s.id === snippetId ? { ...s, usageCount: response.data!.usageCount } : s
            )
          );
        }
        return response;
      } catch (err) {
        return { success: false, error: 'Failed to use snippet' };
      }
    },
    [session?.accessToken, teamId]
  );

  return {
    snippets,
    categories,
    loading,
    error,
    refetch: fetchSnippets,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    useSnippet,
  };
}
