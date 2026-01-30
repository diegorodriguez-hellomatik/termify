'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface CursorPosition {
  odId: string;
  visitorId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  x: number;
  y: number;
  scrollTop: number;
}

interface CollaborativeMessage {
  id: string;
  terminalId: string;
  userId: string;
  content: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
}

interface UseTerminalCollaborationOptions {
  terminalId: string;
  ws: WebSocket | null;
  enabled?: boolean;
}

export function useTerminalCollaboration({
  terminalId,
  ws,
  enabled = true,
}: UseTerminalCollaborationOptions) {
  const { data: session } = useSession();
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const [messages, setMessages] = useState<CollaborativeMessage[]>([]);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<string[]>([]);
  const lastCursorUpdate = useRef<number>(0);

  // Handle incoming collaboration messages
  useEffect(() => {
    if (!ws || !enabled) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'terminal.cursor.positions':
            if (data.terminalId === terminalId) {
              setCursors(data.cursors);
            }
            break;

          case 'terminal.cursor.moved':
            if (data.terminalId === terminalId) {
              setCursors((prev) => {
                const index = prev.findIndex((c) => c.odId === data.cursor.odId);
                if (index >= 0) {
                  const newCursors = [...prev];
                  newCursors[index] = data.cursor;
                  return newCursors;
                }
                return [...prev, data.cursor];
              });
            }
            break;

          case 'terminal.cursor.left':
            if (data.terminalId === terminalId) {
              setCursors((prev) => prev.filter((c) => c.odId !== data.odId));
            }
            break;

          case 'terminal.chat.message':
            if (data.terminalId === terminalId) {
              setMessages((prev) => [...prev, data.message]);
            }
            break;

          case 'terminal.chat.messages':
            if (data.terminalId === terminalId) {
              setMessages(data.messages);
            }
            break;

          case 'terminal.follow.started':
            if (data.terminalId === terminalId) {
              if (data.targetId === session?.user?.id) {
                setFollowers((prev) => [...prev, data.followerId]);
              }
            }
            break;

          case 'terminal.follow.stopped':
            if (data.terminalId === terminalId) {
              setFollowers((prev) => prev.filter((id) => id !== data.followerId));
              if (data.followerId === session?.user?.id) {
                setFollowingId(null);
              }
            }
            break;
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, terminalId, enabled, session?.user?.id]);

  // Request chat history on mount
  useEffect(() => {
    if (!ws || !enabled || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'terminal.chat.history',
        terminalId,
        limit: 50,
      })
    );
  }, [ws, terminalId, enabled]);

  // Move cursor (throttled)
  const moveCursor = useCallback(
    (x: number, y: number, scrollTop: number) => {
      if (!ws || !enabled || ws.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      if (now - lastCursorUpdate.current < 50) return; // Throttle to 20fps
      lastCursorUpdate.current = now;

      ws.send(
        JSON.stringify({
          type: 'terminal.cursor.move',
          terminalId,
          x,
          y,
          scrollTop,
        })
      );
    },
    [ws, terminalId, enabled]
  );

  // Send chat message
  const sendMessage = useCallback(
    (content: string) => {
      if (!ws || !enabled || ws.readyState !== WebSocket.OPEN || !content.trim()) return;

      ws.send(
        JSON.stringify({
          type: 'terminal.chat.send',
          terminalId,
          content: content.trim(),
        })
      );
    },
    [ws, terminalId, enabled]
  );

  // Start following a user
  const startFollowing = useCallback(
    (targetOdId: string) => {
      if (!ws || !enabled || ws.readyState !== WebSocket.OPEN) return;

      ws.send(
        JSON.stringify({
          type: 'terminal.follow.start',
          terminalId,
          targetOdId,
        })
      );
      setFollowingId(targetOdId);
    },
    [ws, terminalId, enabled]
  );

  // Stop following
  const stopFollowing = useCallback(() => {
    if (!ws || !enabled || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'terminal.follow.stop',
        terminalId,
      })
    );
    setFollowingId(null);
  }, [ws, terminalId, enabled]);

  // Sync scroll position
  const syncScroll = useCallback(
    (scrollTop: number) => {
      if (!ws || !enabled || ws.readyState !== WebSocket.OPEN) return;

      ws.send(
        JSON.stringify({
          type: 'terminal.scroll.sync',
          terminalId,
          scrollTop,
        })
      );
    },
    [ws, terminalId, enabled]
  );

  return {
    // Remote cursors (excluding current user)
    cursors: cursors.filter((c) => c.userId !== session?.user?.id),
    // Chat messages
    messages,
    // Following state
    followingId,
    followers,
    isBeingFollowed: followers.length > 0,
    // Actions
    moveCursor,
    sendMessage,
    startFollowing,
    stopFollowing,
    syncScroll,
  };
}
