'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { personalTaskBoardsApi, PersonalTaskBoard } from '@/lib/api';

export function usePersonalTaskBoards() {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const [boards, setBoards] = useState<PersonalTaskBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    if (!accessToken) {
      setBoards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await personalTaskBoardsApi.list(accessToken);
      if (response.success && response.data) {
        setBoards(response.data.boards);
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Failed to fetch boards');
      }
    } catch (err) {
      setError('Failed to fetch boards');
      console.error('[usePersonalTaskBoards] Error fetching boards:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const createBoard = useCallback(async (data: {
    name: string;
    color?: string;
    icon?: string | null;
    isDefault?: boolean;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await personalTaskBoardsApi.create(data, accessToken);
      if (response.success && response.data) {
        setBoards((prev) => [...prev, response.data!]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[usePersonalTaskBoards] Error creating board:', err);
      return null;
    }
  }, [accessToken]);

  const updateBoard = useCallback(async (id: string, data: {
    name?: string;
    color?: string;
    icon?: string | null;
    isDefault?: boolean;
  }) => {
    if (!accessToken) return null;

    try {
      const response = await personalTaskBoardsApi.update(id, data, accessToken);
      if (response.success && response.data) {
        setBoards((prev) =>
          prev.map((board) => (board.id === id ? { ...board, ...response.data } : board))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[usePersonalTaskBoards] Error updating board:', err);
      return null;
    }
  }, [accessToken]);

  const deleteBoard = useCallback(async (id: string) => {
    if (!accessToken) return false;

    try {
      const response = await personalTaskBoardsApi.delete(id, accessToken);
      if (response.success) {
        setBoards((prev) => prev.filter((board) => board.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('[usePersonalTaskBoards] Error deleting board:', err);
      return false;
    }
  }, [accessToken]);

  const reorderBoards = useCallback(async (boardIds: string[]) => {
    if (!accessToken) return false;

    try {
      const response = await personalTaskBoardsApi.reorder({ boardIds }, accessToken);
      if (response.success) {
        // Update local state with new positions
        setBoards((prev) => {
          const updated = [...prev];
          boardIds.forEach((id, index) => {
            const boardIndex = updated.findIndex((b) => b.id === id);
            if (boardIndex !== -1) {
              updated[boardIndex] = { ...updated[boardIndex], position: index };
            }
          });
          return updated.sort((a, b) => a.position - b.position);
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[usePersonalTaskBoards] Error reordering boards:', err);
      return false;
    }
  }, [accessToken]);

  // Fetch boards on mount
  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  return {
    boards,
    loading,
    error,
    fetchBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    reorderBoards,
  };
}
