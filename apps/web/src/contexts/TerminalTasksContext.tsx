'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TaskExecutionInfo {
  taskId: string;
  terminalId: string;
  terminalName: string;
  commandsCompleted: number;
  commandsTotal: number;
}

interface TerminalTasksContextType {
  executingTasks: Map<string, TaskExecutionInfo>;
  startTaskExecution: (info: TaskExecutionInfo) => void;
  updateTaskProgress: (taskId: string, commandsCompleted: number) => void;
  endTaskExecution: (taskId: string) => void;
  getTerminalForTask: (taskId: string) => TaskExecutionInfo | null;
  getTasksForTerminal: (terminalId: string) => TaskExecutionInfo[];
}

const TerminalTasksContext = createContext<TerminalTasksContextType | null>(null);

interface TerminalTasksProviderProps {
  children: ReactNode;
}

export function TerminalTasksProvider({ children }: TerminalTasksProviderProps) {
  const [executingTasks, setExecutingTasks] = useState<Map<string, TaskExecutionInfo>>(new Map());

  const startTaskExecution = useCallback((info: TaskExecutionInfo) => {
    setExecutingTasks((prev) => {
      const next = new Map(prev);
      next.set(info.taskId, info);
      return next;
    });
  }, []);

  const updateTaskProgress = useCallback((taskId: string, commandsCompleted: number) => {
    setExecutingTasks((prev) => {
      const info = prev.get(taskId);
      if (!info) return prev;
      const next = new Map(prev);
      next.set(taskId, { ...info, commandsCompleted });
      return next;
    });
  }, []);

  const endTaskExecution = useCallback((taskId: string) => {
    setExecutingTasks((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  const getTerminalForTask = useCallback(
    (taskId: string): TaskExecutionInfo | null => {
      return executingTasks.get(taskId) || null;
    },
    [executingTasks]
  );

  const getTasksForTerminal = useCallback(
    (terminalId: string): TaskExecutionInfo[] => {
      const tasks: TaskExecutionInfo[] = [];
      executingTasks.forEach((info) => {
        if (info.terminalId === terminalId) {
          tasks.push(info);
        }
      });
      return tasks;
    },
    [executingTasks]
  );

  return (
    <TerminalTasksContext.Provider
      value={{
        executingTasks,
        startTaskExecution,
        updateTaskProgress,
        endTaskExecution,
        getTerminalForTask,
        getTasksForTerminal,
      }}
    >
      {children}
    </TerminalTasksContext.Provider>
  );
}

export function useTerminalTasks(): TerminalTasksContextType {
  const context = useContext(TerminalTasksContext);
  if (!context) {
    throw new Error('useTerminalTasks must be used within a TerminalTasksProvider');
  }
  return context;
}

export function useTerminalTasksOptional(): TerminalTasksContextType | null {
  return useContext(TerminalTasksContext);
}
