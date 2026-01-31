'use client';

import { useEffect, useRef, useCallback } from 'react';
import { TerminalStatus } from '@termify/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface Terminal {
  id: string;
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  createdAt: string;
  lastActiveAt: string | null;
  categoryId: string | null;
  position: number;
  isFavorite?: boolean;
  isWorking?: boolean;
  category?: { id: string; name: string; color: string; icon?: string } | null;
}

interface TerminalsListSocketCallbacks {
  onTerminalWorking?: (terminalId: string, isWorking: boolean) => void;
  onTerminalCreated?: (terminal: Terminal) => void;
  onTerminalUpdated?: (terminal: Terminal) => void;
  onTerminalDeleted?: (terminalId: string) => void;
  onTerminalStatusChanged?: (terminalId: string, status: TerminalStatus) => void;
}

interface UseTerminalsListSocketOptions {
  token: string | null;
  callbacks: TerminalsListSocketCallbacks;
}

export function useTerminalsListSocket({
  token,
  callbacks,
}: UseTerminalsListSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const cb = callbacksRef.current;

      switch (message.type) {
        case 'terminal.working':
          console.log('[TerminalsListSocket] Terminal working:', message.terminalId, message.isWorking);
          cb.onTerminalWorking?.(message.terminalId, message.isWorking);
          break;

        case 'terminal.created':
          console.log('[TerminalsListSocket] Terminal created:', message.terminal);
          cb.onTerminalCreated?.(message.terminal);
          break;

        case 'terminal.updated':
          console.log('[TerminalsListSocket] Terminal updated:', message.terminal);
          cb.onTerminalUpdated?.(message.terminal);
          break;

        case 'terminal.deleted':
          console.log('[TerminalsListSocket] Terminal deleted:', message.terminalId);
          cb.onTerminalDeleted?.(message.terminalId);
          break;

        case 'terminal.status':
          console.log('[TerminalsListSocket] Terminal status:', message.terminalId, message.status);
          cb.onTerminalStatusChanged?.(message.terminalId, message.status);
          break;

        case 'pong':
          // Ignore pong messages
          break;

        default:
          // Ignore other message types
          break;
      }
    } catch (err) {
      console.error('[TerminalsListSocket] Failed to parse message:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[TerminalsListSocket] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[TerminalsListSocket] Connected');

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[TerminalsListSocket] Disconnected:', event.code);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless it was intentional
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[TerminalsListSocket] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[TerminalsListSocket] Error:', error);
    };
  }, [token, handleMessage]);

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
  }, []);

  // Connect when token is available
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
