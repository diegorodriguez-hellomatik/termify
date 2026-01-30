'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TeamMessage, OnlineMember } from '@termify/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface UseTeamChatOptions {
  token: string | null;
  teamId: string | null;
  enabled?: boolean;
}

export function useTeamChat({ token, teamId, enabled = true }: UseTeamChatOptions) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chat.team.message':
          if (data.teamId === teamId) {
            setMessages((prev) => [...prev, data.message]);
          }
          break;

        case 'chat.team.messages':
          if (data.teamId === teamId) {
            setMessages(data.messages);
            setIsLoading(false);
          }
          break;

        case 'chat.team.online':
          if (data.teamId === teamId) {
            setOnlineMembers(data.members);
          }
          break;

        case 'pong':
          // Ignore pong messages
          break;

        default:
          // Ignore other message types
          break;
      }
    } catch (err) {
      console.error('[TeamChat] Failed to parse message:', err);
    }
  }, [teamId]);

  const connect = useCallback(() => {
    if (!token || !teamId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[TeamChat] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[TeamChat] Connected');
      setIsConnected(true);

      // Subscribe to team
      ws.send(JSON.stringify({ type: 'team.subscribe', teamId }));

      // Request chat history
      ws.send(JSON.stringify({ type: 'chat.team.history', teamId, limit: 50 }));

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[TeamChat] Disconnected:', event.code);
      setIsConnected(false);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless it was intentional
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[TeamChat] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[TeamChat] Error:', error);
    };
  }, [token, teamId, enabled, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !teamId) {
      console.error('[TeamChat] Cannot send message: not connected');
      return;
    }

    if (!content.trim()) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat.team.send',
      teamId,
      content: content.trim(),
    }));
  }, [teamId]);

  const loadMoreMessages = useCallback((before: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !teamId) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'chat.team.history',
      teamId,
      limit: 50,
      before,
    }));
  }, [teamId]);

  // Connect when enabled
  useEffect(() => {
    if (enabled && token && teamId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, token, teamId, connect, disconnect]);

  // Reset state when teamId changes
  useEffect(() => {
    setMessages([]);
    setOnlineMembers([]);
    setIsLoading(true);
  }, [teamId]);

  return {
    messages,
    onlineMembers,
    isLoading,
    isConnected,
    sendMessage,
    loadMoreMessages,
  };
}
