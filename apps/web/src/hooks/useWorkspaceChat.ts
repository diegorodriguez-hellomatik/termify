'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { WorkspaceMessage, OnlineMember } from '@termify/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface UseWorkspaceChatOptions {
  token: string | null;
  workspaceId: string | null;
  enabled?: boolean;
}

export function useWorkspaceChat({ token, workspaceId, enabled = true }: UseWorkspaceChatOptions) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Debug: log all messages related to workspace chat
      if (data.type?.startsWith('chat.workspace') || data.type?.startsWith('workspace.')) {
        console.log('[WorkspaceChat] Received:', data.type, data);
      }

      switch (data.type) {
        case 'workspace.subscribed':
          if (data.workspaceId === workspaceId) {
            console.log('[WorkspaceChat] Subscribed to workspace');
          }
          break;

        case 'chat.workspace.message':
          if (data.workspaceId === workspaceId) {
            setMessages((prev) => [...prev, data.message]);
          }
          break;

        case 'chat.workspace.messages':
          console.log('[WorkspaceChat] Received messages:', data.messages?.length, 'for workspace:', data.workspaceId, 'expected:', workspaceId);
          if (data.workspaceId === workspaceId) {
            setMessages(data.messages || []);
            setIsLoading(false);
          }
          break;

        case 'chat.workspace.online':
          if (data.workspaceId === workspaceId) {
            setOnlineUsers(data.users || []);
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
      console.error('[WorkspaceChat] Failed to parse message:', err);
    }
  }, [workspaceId]);

  const connect = useCallback(() => {
    if (!token || !workspaceId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[WorkspaceChat] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WorkspaceChat] Connected');
      setIsConnected(true);

      // Subscribe to workspace
      ws.send(JSON.stringify({ type: 'workspace.subscribe', workspaceId }));

      // Request chat history
      ws.send(JSON.stringify({ type: 'chat.workspace.history', workspaceId, limit: 50 }));

      // Set a timeout to stop loading if no response comes (empty chat)
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[WorkspaceChat] Disconnected:', event.code);
      setIsConnected(false);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless it was intentional
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WorkspaceChat] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[WorkspaceChat] Error:', error);
    };
  }, [token, workspaceId, enabled, handleMessage]);

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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !workspaceId) {
      console.error('[WorkspaceChat] Cannot send message: not connected');
      return;
    }

    if (!content.trim()) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat.workspace.send',
      workspaceId,
      content: content.trim(),
    }));
  }, [workspaceId]);

  const loadMoreMessages = useCallback((before: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !workspaceId) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'chat.workspace.history',
      workspaceId,
      limit: 50,
      before,
    }));
  }, [workspaceId]);

  // Connect when enabled
  useEffect(() => {
    if (enabled && token && workspaceId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, token, workspaceId, connect, disconnect]);

  // Reset state when workspaceId changes
  useEffect(() => {
    setMessages([]);
    setOnlineUsers([]);
    setIsLoading(true);
  }, [workspaceId]);

  return {
    messages,
    onlineUsers,
    isLoading,
    isConnected,
    sendMessage,
    loadMoreMessages,
  };
}
