'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  ClientMessage,
  ServerMessage,
  TerminalStatus,
} from '@termify/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface UseTerminalSocketOptions {
  terminalId: string;
  token: string;
  shareToken?: string;
  onOutput: (data: string) => void;
  onStatusChange: (status: TerminalStatus) => void;
  onConnected: (bufferedOutput?: string) => void;
  onError: (error: string) => void;
  onFilesChanged?: () => void;
}

interface UseTerminalSocketReturn {
  isConnected: boolean;
  send: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  start: () => void;
  stop: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useTerminalSocket({
  terminalId,
  token,
  shareToken,
  onOutput,
  onStatusChange,
  onConnected,
  onError,
  onFilesChanged,
}: UseTerminalSocketOptions): UseTerminalSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use refs to always access the latest callback values
  // This prevents stale closures when callbacks are captured by WebSocket handlers
  const callbacksRef = useRef({
    onOutput,
    onStatusChange,
    onConnected,
    onError,
    onFilesChanged,
  } as {
    onOutput: (data: string) => void;
    onStatusChange: (status: TerminalStatus) => void;
    onConnected: (bufferedOutput?: string) => void;
    onError: (error: string) => void;
    onFilesChanged?: () => void;
  });

  // Update refs whenever callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onOutput,
      onStatusChange,
      onConnected,
      onError,
      onFilesChanged,
    };
  }, [onOutput, onStatusChange, onConnected, onError, onFilesChanged]);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      const { onOutput, onStatusChange, onConnected, onError, onFilesChanged } = callbacksRef.current;

      switch (message.type) {
        case 'pong':
          // Heartbeat response
          break;

        case 'terminal.output':
          if (message.terminalId === terminalId) {
            console.log('[WS] Output received, length:', message.data.length);
            onOutput(message.data);
          }
          break;

        case 'terminal.connected':
          if (message.terminalId === terminalId) {
            console.log('[WS] Terminal connected, buffered:', !!message.bufferedOutput);
            onConnected(message.bufferedOutput);
          }
          break;

        case 'terminal.status':
          if (message.terminalId === terminalId) {
            console.log('[WS] Status change:', message.status);
            onStatusChange(message.status);
          }
          break;

        case 'terminal.error':
          if (message.terminalId === terminalId) {
            onError(message.error);
          }
          break;

        case 'files.changed':
          if (message.terminalId === terminalId) {
            console.log('[WS] Files changed');
            // Dispatch custom event so FileExplorer can listen
            window.dispatchEvent(new CustomEvent('terminal-files-changed', {
              detail: { terminalId }
            }));
            onFilesChanged?.();
          }
          break;

        case 'terminal.cwd':
          if (message.terminalId === terminalId) {
            console.log('[WS] CWD changed:', message.cwd);
            // Dispatch custom event so FileExplorer can sync to the new directory
            window.dispatchEvent(new CustomEvent('terminal-cwd-changed', {
              detail: { terminalId, cwd: message.cwd }
            }));
          }
          break;

        case 'error':
          onError(message.message);
          break;
      }
    },
    [terminalId]
  );

  const connect = useCallback(() => {
    // If already connected, just send terminal.connect
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected, re-sending terminal.connect');
      sendMessage({ type: 'terminal.connect', terminalId, shareToken });
      return;
    }

    // Require a real token - don't fallback to 'dev' to avoid identity issues
    if (!token) {
      console.error('[WS] No authentication token available');
      callbacksRef.current.onError('No authentication token');
      return;
    }
    console.log('[WS] Creating new WebSocket connection');
    // Include shareToken in URL if provided (for share link access)
    const wsUrl = shareToken
      ? `${WS_URL}?token=${token}&shareToken=${shareToken}`
      : `${WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected, sending terminal.connect for:', terminalId);
      setIsConnected(true);

      // Connect to terminal (include shareToken if provided)
      sendMessage({ type: 'terminal.connect', terminalId, shareToken });

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        sendMessage({ type: 'ping' });
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        handleMessage(message);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Attempt reconnect unless it was a normal close
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WS] Attempting reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      callbacksRef.current.onError('WebSocket connection error');
    };
  }, [token, terminalId, shareToken, sendMessage, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback(
    (data: string) => {
      sendMessage({ type: 'terminal.input', terminalId, data });
    },
    [terminalId, sendMessage]
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      sendMessage({ type: 'terminal.resize', terminalId, cols, rows });
    },
    [terminalId, sendMessage]
  );

  const start = useCallback(() => {
    sendMessage({ type: 'terminal.start', terminalId });
  }, [terminalId, sendMessage]);

  const stop = useCallback(() => {
    sendMessage({ type: 'terminal.stop', terminalId });
  }, [terminalId, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    send,
    resize,
    start,
    stop,
    connect,
    disconnect,
  };
}
