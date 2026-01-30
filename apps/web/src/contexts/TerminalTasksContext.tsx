'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ExecutingTaskInfo {
  taskId: string;
  taskTitle: string;
  queueId: string;
  terminalId: string;
  terminalName: string;
  commandsTotal: number;
  commandsCompleted: number;
  startedAt: Date;
}

interface TerminalTasksContextValue {
  // Map of terminalId -> ExecutingTaskInfo
  executingTasks: Map<string, ExecutingTaskInfo>;
  // Register a task execution
  registerExecution: (info: ExecutingTaskInfo) => void;
  // Update command progress
  updateProgress: (queueId: string, commandsCompleted: number) => void;
  // Clear a task execution (when completed/failed/cancelled)
  clearExecution: (queueId: string) => void;
  // Get which terminal is executing a specific task
  getTerminalForTask: (taskId: string) => ExecutingTaskInfo | undefined;
  // Get the task being executed by a specific terminal
  getTaskForTerminal: (terminalId: string) => ExecutingTaskInfo | undefined;
}

const TerminalTasksContext = createContext<TerminalTasksContextValue | null>(null);

export function TerminalTasksProvider({ children }: { children: ReactNode }) {
  const [executingTasks, setExecutingTasks] = useState<Map<string, ExecutingTaskInfo>>(new Map());

  const registerExecution = useCallback((info: ExecutingTaskInfo) => {
    setExecutingTasks(prev => {
      const next = new Map(prev);
      next.set(info.terminalId, info);
      return next;
    });
  }, []);

  const updateProgress = useCallback((queueId: string, commandsCompleted: number) => {
    setExecutingTasks(prev => {
      const next = new Map(prev);
      for (const [terminalId, task] of next) {
        if (task.queueId === queueId) {
          next.set(terminalId, { ...task, commandsCompleted });
          break;
        }
      }
      return next;
    });
  }, []);

  const clearExecution = useCallback((queueId: string) => {
    setExecutingTasks(prev => {
      const next = new Map(prev);
      for (const [terminalId, task] of next) {
        if (task.queueId === queueId) {
          next.delete(terminalId);
          break;
        }
      }
      return next;
    });
  }, []);

  const getTerminalForTask = useCallback((taskId: string): ExecutingTaskInfo | undefined => {
    for (const task of executingTasks.values()) {
      if (task.taskId === taskId) {
        return task;
      }
    }
    return undefined;
  }, [executingTasks]);

  const getTaskForTerminal = useCallback((terminalId: string): ExecutingTaskInfo | undefined => {
    return executingTasks.get(terminalId);
  }, [executingTasks]);

  return (
    <TerminalTasksContext.Provider
      value={{
        executingTasks,
        registerExecution,
        updateProgress,
        clearExecution,
        getTerminalForTask,
        getTaskForTerminal,
      }}
    >
      {children}
    </TerminalTasksContext.Provider>
  );
}

export function useTerminalTasks() {
  const context = useContext(TerminalTasksContext);
  if (!context) {
    throw new Error('useTerminalTasks must be used within a TerminalTasksProvider');
  }
  return context;
}

// Optional hook that returns null instead of throwing if context is not available
export function useTerminalTasksOptional() {
  return useContext(TerminalTasksContext);
}
