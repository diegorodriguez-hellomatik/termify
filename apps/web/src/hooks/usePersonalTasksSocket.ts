'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { PersonalTask } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export interface QueueEvent {
  type: string;
  terminalId: string;
  queueId: string;
  name: string;
  taskId?: string;
  reason?: string;
}

interface PersonalTasksSocketCallbacks {
  onTaskCreated?: (task: PersonalTask) => void;
  onTaskUpdated?: (task: PersonalTask, previousStatus?: string) => void;
  onTaskDeleted?: (taskId: string, status: string) => void;
  onTasksReordered?: (tasks: PersonalTask[], status: string) => void;
  onQueueCompleted?: (event: QueueEvent) => void;
  onQueueFailed?: (event: QueueEvent) => void;
  onQueueCancelled?: (event: QueueEvent) => void;
  onQueueStarted?: (event: QueueEvent) => void;
  onQueueCommandStarted?: (event: QueueEvent & { commandId: string }) => void;
  onQueueCommandCompleted?: (event: QueueEvent & { commandId: string; exitCode: number }) => void;
}

interface UsePersonalTasksSocketOptions {
  token: string | null;
  callbacks: PersonalTasksSocketCallbacks;
}

export function usePersonalTasksSocket({ token, callbacks }: UsePersonalTasksSocketOptions) {
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
        case 'personal-task.created':
          console.log('[PersonalTasksSocket] Task created:', message.task);
          cb.onTaskCreated?.(message.task);
          break;

        case 'personal-task.updated':
          console.log('[PersonalTasksSocket] Task updated:', message.task);
          cb.onTaskUpdated?.(message.task, message.previousStatus);
          break;

        case 'personal-task.deleted':
          console.log('[PersonalTasksSocket] Task deleted:', message.taskId);
          cb.onTaskDeleted?.(message.taskId, message.status);
          break;

        case 'personal-task.reordered':
          console.log('[PersonalTasksSocket] Tasks reordered:', message.tasks?.length, 'tasks in', message.status);
          cb.onTasksReordered?.(message.tasks, message.status);
          break;

        case 'pong':
          // Ignore pong messages
          break;

        // Queue events for auto-pilot
        case 'queue.started':
          console.log('[PersonalTasksSocket] Queue started:', message.queueId);
          cb.onQueueStarted?.(message);
          break;

        case 'queue.completed':
          console.log('[PersonalTasksSocket] Queue completed:', message.queueId);
          cb.onQueueCompleted?.(message);
          break;

        case 'queue.failed':
          console.log('[PersonalTasksSocket] Queue failed:', message.queueId, message.reason);
          cb.onQueueFailed?.(message);
          break;

        case 'queue.cancelled':
          console.log('[PersonalTasksSocket] Queue cancelled:', message.queueId);
          cb.onQueueCancelled?.(message);
          break;

        case 'queue.command.started':
          console.log('[PersonalTasksSocket] Command started:', message.commandId);
          cb.onQueueCommandStarted?.(message);
          break;

        case 'queue.command.completed':
          console.log('[PersonalTasksSocket] Command completed:', message.commandId, 'exitCode:', message.exitCode);
          cb.onQueueCommandCompleted?.(message);
          break;

        default:
          // Ignore other message types
          break;
      }
    } catch (err) {
      console.error('[PersonalTasksSocket] Failed to parse message:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[PersonalTasksSocket] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[PersonalTasksSocket] Connected');

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[PersonalTasksSocket] Disconnected:', event.code);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless it was intentional
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[PersonalTasksSocket] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[PersonalTasksSocket] Error:', error);
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
