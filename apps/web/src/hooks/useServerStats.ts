import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

export interface ServerStats {
  cpu: number[];
  cpuAvg: number;
  memory: {
    total: number;
    used: number;
    swapTotal: number;
    swapUsed: number;
  };
  disks: Array<{
    name: string;
    available: number;
    total: number;
  }>;
  network: Array<{
    interface: string;
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    rxErrors: number;
    txErrors: number;
  }>;
  processes: Array<{
    pid: number;
    name: string;
    exe: string;
    memory: number;
    cpu: number;
  }>;
  os?: {
    name: string;
    kernel: string;
    version: string;
    arch: string;
  };
  timestamp: number;
}

interface UseServerStatsOptions {
  enabled?: boolean;
}

interface UseServerStatsReturn {
  stats: ServerStats | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  history: ServerStats[];
  subscribe: () => void;
  unsubscribe: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3030';
const MAX_HISTORY = 60; // Keep last 60 data points (5 minutes at 5s interval)

export function useServerStats(
  serverId: string | null,
  options: UseServerStatsOptions = {}
): UseServerStatsReturn {
  const { enabled = true } = options;
  const { data: session } = useSession();

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [history, setHistory] = useState<ServerStats[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    // In development, use 'dev' token if no session token available
    const isDev = process.env.NODE_ENV === 'development';
    const token = session?.accessToken || (isDev ? 'dev' : null);

    if (!token || !serverId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    setError(null);

    console.log('[ServerStats] Connecting with token:', token === 'dev' ? 'dev' : 'session token');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ServerStats] WebSocket connected');
      setIsConnecting(false);

      // Subscribe to server stats
      ws.send(JSON.stringify({
        type: 'server.stats.subscribe',
        serverId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'server.stats.subscribed':
            console.log('[ServerStats] Subscribed to', message.serverId);
            subscribedRef.current = true;
            setError(null); // Clear any previous error
            break;

          case 'server.stats':
            if (message.serverId === serverId) {
              const newStats = message.stats as ServerStats;
              setStats(newStats);
              setError(null); // Clear error when we receive valid stats
              setIsConnected(true); // We're connected if we're receiving stats
              setHistory(prev => {
                const updated = [...prev, newStats];
                return updated.slice(-MAX_HISTORY);
              });
            }
            break;

          case 'server.stats.connected':
            setIsConnected(true);
            setError(null);
            break;

          case 'server.stats.disconnected':
            setIsConnected(false);
            break;

          case 'server.stats.error':
            setError(message.error);
            break;

          case 'pong':
            // Keep-alive response
            break;
        }
      } catch (e) {
        console.error('[ServerStats] Failed to parse message:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('[ServerStats] WebSocket error:', event);
      setError('Connection error');
      setIsConnecting(false);
    };

    ws.onclose = (event) => {
      console.log('[ServerStats] WebSocket closed:', event.code);
      setIsConnecting(false);
      setIsConnected(false);
      subscribedRef.current = false;
      wsRef.current = null;

      // Reconnect after 5 seconds if not intentionally closed
      if (event.code !== 1000 && enabled) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [session?.accessToken, serverId, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Unsubscribe first
      if (wsRef.current.readyState === WebSocket.OPEN && subscribedRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'server.stats.unsubscribe',
          serverId,
        }));
      }
      wsRef.current.close(1000);
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    subscribedRef.current = false;
  }, [serverId]);

  const subscribe = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
    } else if (!subscribedRef.current && serverId) {
      wsRef.current.send(JSON.stringify({
        type: 'server.stats.subscribe',
        serverId,
      }));
    }
  }, [connect, serverId]);

  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && subscribedRef.current && serverId) {
      wsRef.current.send(JSON.stringify({
        type: 'server.stats.unsubscribe',
        serverId,
      }));
      subscribedRef.current = false;
    }
  }, [serverId]);

  // Connect when serverId changes or enabled becomes true
  useEffect(() => {
    if (serverId && enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [serverId, enabled, connect, disconnect]);

  // Keep-alive ping
  useEffect(() => {
    if (!wsRef.current) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  return {
    stats,
    isConnected,
    isConnecting,
    error,
    history,
    subscribe,
    unsubscribe,
  };
}

// Utility functions for formatting stats
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatPercent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
