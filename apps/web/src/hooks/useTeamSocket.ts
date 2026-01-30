'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Task, TaskStatus, TeamMember, TeamRole } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

interface TeamSocketCallbacks {
  onMemberJoined?: (member: TeamMember) => void;
  onMemberLeft?: (memberId: string) => void;
  onMemberRoleChanged?: (memberId: string, role: TeamRole) => void;
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  onTaskStatusChanged?: (taskId: string, status: TaskStatus, changedById: string) => void;
  onTaskAssigned?: (taskId: string, assignee: any) => void;
  onTaskUnassigned?: (taskId: string, assigneeId: string) => void;
}

interface UseTeamSocketOptions {
  token: string | null;
  teamId: string | null;
  callbacks: TeamSocketCallbacks;
}

export function useTeamSocket({ token, teamId, callbacks }: UseTeamSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const subscribeToTeam = useCallback((ws: WebSocket, id: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'team.subscribe', teamId: id }));
    }
  }, []);

  const unsubscribeFromTeam = useCallback((ws: WebSocket, id: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'team.unsubscribe', teamId: id }));
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const cb = callbacksRef.current;

      switch (message.type) {
        case 'team.subscribed':
          console.log('[TeamSocket] Subscribed to team:', message.teamId);
          break;

        case 'team.member.joined':
          console.log('[TeamSocket] Member joined:', message.member);
          cb.onMemberJoined?.(message.member);
          break;

        case 'team.member.left':
          console.log('[TeamSocket] Member left:', message.memberId);
          cb.onMemberLeft?.(message.memberId);
          break;

        case 'team.member.role.changed':
          console.log('[TeamSocket] Member role changed:', message.memberId, message.role);
          cb.onMemberRoleChanged?.(message.memberId, message.role);
          break;

        case 'task.created':
          console.log('[TeamSocket] Task created:', message.task);
          cb.onTaskCreated?.(message.task);
          break;

        case 'task.updated':
          console.log('[TeamSocket] Task updated:', message.task);
          cb.onTaskUpdated?.(message.task);
          break;

        case 'task.deleted':
          console.log('[TeamSocket] Task deleted:', message.taskId);
          cb.onTaskDeleted?.(message.taskId);
          break;

        case 'task.status.changed':
          console.log('[TeamSocket] Task status changed:', message.taskId, message.status);
          cb.onTaskStatusChanged?.(message.taskId, message.status, message.changedById);
          break;

        case 'task.assigned':
          console.log('[TeamSocket] Task assigned:', message.taskId, message.assignee);
          cb.onTaskAssigned?.(message.taskId, message.assignee);
          break;

        case 'task.unassigned':
          console.log('[TeamSocket] Task unassigned:', message.taskId, message.assigneeId);
          cb.onTaskUnassigned?.(message.taskId, message.assigneeId);
          break;

        case 'pong':
          // Ignore pong messages
          break;

        default:
          // Ignore other message types (terminal events, etc.)
          break;
      }
    } catch (err) {
      console.error('[TeamSocket] Failed to parse message:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[TeamSocket] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[TeamSocket] Connected');

      // Subscribe to team if we have one
      if (teamId) {
        subscribeToTeam(ws, teamId);
      }

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[TeamSocket] Disconnected:', event.code);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless it was intentional
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[TeamSocket] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[TeamSocket] Error:', error);
    };
  }, [token, teamId, handleMessage, subscribeToTeam]);

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

  // Handle team changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // If teamId changed, unsubscribe from old and subscribe to new
    if (teamId) {
      subscribeToTeam(ws, teamId);
    }

    return () => {
      if (teamId && ws.readyState === WebSocket.OPEN) {
        unsubscribeFromTeam(ws, teamId);
      }
    };
  }, [teamId, subscribeToTeam, unsubscribeFromTeam]);

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
