'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3030';
const MAX_HISTORY = 60;

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

interface ServerStatsState {
  stats: ServerStats | null;
  history: ServerStats[];
  isConnected: boolean;
  error: string | null;
  terminalCount: number;
}

interface ServerStatsContextValue {
  // Get stats for a specific server
  getServerStats: (serverId: string) => ServerStatsState;
  // Subscribe to a server's stats
  subscribe: (serverId: string) => void;
  // Unsubscribe from a server's stats
  unsubscribe: (serverId: string) => void;
  // Subscribe to multiple servers at once
  subscribeMany: (serverIds: string[]) => void;
  // Check if WebSocket is connected
  isWebSocketConnected: boolean;
  // All subscribed server IDs
  subscribedServers: Set<string>;
}

const defaultState: ServerStatsState = {
  stats: null,
  history: [],
  isConnected: false,
  error: null,
  terminalCount: 0,
};

const ServerStatsContext = createContext<ServerStatsContextValue | null>(null);

export function ServerStatsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track all server stats
  const [serverStates, setServerStates] = useState<Map<string, ServerStatsState>>(new Map());
  const [subscribedServers, setSubscribedServers] = useState<Set<string>>(new Set());
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  // Pending subscriptions (servers to subscribe when WS connects)
  const pendingSubscriptionsRef = useRef<Set<string>>(new Set());

  const updateServerState = useCallback((serverId: string, update: Partial<ServerStatsState>) => {
    setServerStates(prev => {
      const current = prev.get(serverId) || { ...defaultState };
      const newMap = new Map(prev);
      newMap.set(serverId, { ...current, ...update });
      return newMap;
    });
  }, []);

  const addToHistory = useCallback((serverId: string, stats: ServerStats) => {
    setServerStates(prev => {
      const current = prev.get(serverId) || { ...defaultState };
      const newHistory = [...current.history, stats].slice(-MAX_HISTORY);
      const newMap = new Map(prev);
      newMap.set(serverId, {
        ...current,
        stats,
        history: newHistory,
        isConnected: true,
        error: null,
      });
      return newMap;
    });
  }, []);

  const connect = useCallback(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const token = session?.accessToken || (isDev ? 'dev' : null);

    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    console.log('[ServerStatsManager] Connecting WebSocket...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ServerStatsManager] WebSocket connected');
      setIsWebSocketConnected(true);

      // Subscribe to all pending servers
      pendingSubscriptionsRef.current.forEach(serverId => {
        ws.send(JSON.stringify({
          type: 'server.stats.subscribe',
          serverId,
        }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'server.stats.subscribed':
            console.log('[ServerStatsManager] Subscribed to', message.serverId);
            setSubscribedServers(prev => new Set(prev).add(message.serverId));
            updateServerState(message.serverId, { error: null });
            break;

          case 'server.stats':
            addToHistory(message.serverId, message.stats);
            break;

          case 'server.stats.connected':
            updateServerState(message.serverId, { isConnected: true, error: null });
            break;

          case 'server.stats.disconnected':
            updateServerState(message.serverId, { isConnected: false });
            break;

          case 'server.stats.error':
            updateServerState(message.serverId, { error: message.error });
            break;

          case 'server.terminalCount':
            updateServerState(message.serverId, { terminalCount: message.count });
            break;

          case 'pong':
            break;
        }
      } catch (e) {
        console.error('[ServerStatsManager] Failed to parse message:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('[ServerStatsManager] WebSocket error:', event);
      setIsWebSocketConnected(false);
    };

    ws.onclose = (event) => {
      console.log('[ServerStatsManager] WebSocket closed:', event.code);
      setIsWebSocketConnected(false);
      wsRef.current = null;

      // Mark all servers as disconnected
      setServerStates(prev => {
        const newMap = new Map(prev);
        prev.forEach((state, serverId) => {
          newMap.set(serverId, { ...state, isConnected: false });
        });
        return newMap;
      });

      // Reconnect after 3 seconds if not intentionally closed
      if (event.code !== 1000 && pendingSubscriptionsRef.current.size > 0) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
  }, [session?.accessToken, updateServerState, addToHistory]);

  const subscribe = useCallback((serverId: string) => {
    pendingSubscriptionsRef.current.add(serverId);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'server.stats.subscribe',
        serverId,
      }));
    } else {
      // Connect if not connected
      connect();
    }
  }, [connect]);

  const unsubscribe = useCallback((serverId: string) => {
    pendingSubscriptionsRef.current.delete(serverId);
    setSubscribedServers(prev => {
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'server.stats.unsubscribe',
        serverId,
      }));
    }

    // If no more subscriptions, close the connection
    if (pendingSubscriptionsRef.current.size === 0 && wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
  }, []);

  const subscribeMany = useCallback((serverIds: string[]) => {
    serverIds.forEach(id => {
      pendingSubscriptionsRef.current.add(id);
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      serverIds.forEach(serverId => {
        wsRef.current!.send(JSON.stringify({
          type: 'server.stats.subscribe',
          serverId,
        }));
      });
    } else {
      connect();
    }
  }, [connect]);

  const getServerStats = useCallback((serverId: string): ServerStatsState => {
    return serverStates.get(serverId) || { ...defaultState };
  }, [serverStates]);

  // Keep-alive ping
  useEffect(() => {
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, []);

  return (
    <ServerStatsContext.Provider
      value={{
        getServerStats,
        subscribe,
        unsubscribe,
        subscribeMany,
        isWebSocketConnected,
        subscribedServers,
      }}
    >
      {children}
    </ServerStatsContext.Provider>
  );
}

export function useServerStatsManager() {
  const context = useContext(ServerStatsContext);
  if (!context) {
    throw new Error('useServerStatsManager must be used within ServerStatsProvider');
  }
  return context;
}

// Hook for individual server stats (convenience wrapper)
export function useServerStatsFromManager(serverId: string | null) {
  const { getServerStats, subscribe, unsubscribe } = useServerStatsManager();

  useEffect(() => {
    if (serverId) {
      subscribe(serverId);
      return () => unsubscribe(serverId);
    }
  }, [serverId, subscribe, unsubscribe]);

  if (!serverId) {
    return { stats: null, history: [], isConnected: false, error: null };
  }

  return getServerStats(serverId);
}
