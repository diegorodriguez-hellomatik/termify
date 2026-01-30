'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Play, Pause, RefreshCw, Terminal, Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoPilot } from '@/hooks/useAutoPilot';
import { TaskPriority } from '@/lib/api';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';

interface AutoPilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    URGENT: 'bg-red-500/20 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const icons: Record<TaskPriority, string> = {
    URGENT: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
      colors[priority]
    )}>
      <span>{icons[priority]}</span>
      {priority}
    </span>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function AutoPilotPanel({ isOpen, onClose, position }: AutoPilotPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    enabled,
    executingTasks,
    availableTasks,
    loading,
    toggleEnabled,
    refreshTasks,
  } = useAutoPilot();

  const { tabs } = useWorkspace();

  // Get terminal tabs
  const terminalTabs = tabs.filter((tab): tab is Tab & { terminalId: string } =>
    tab.type === 'terminal' && !!tab.terminalId
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Get terminal status
  const getTerminalStatus = (terminalId: string) => {
    const executing = executingTasks.find(t => t.terminalId === terminalId);
    return executing ? 'executing' : 'idle';
  };

  const panelContent = (
    <div
      ref={panelRef}
      className="fixed bg-background border border-border rounded-lg shadow-2xl w-80 z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        top: position?.y ?? 60,
        right: position?.x ?? 16,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className={cn(
            'h-4 w-4',
            enabled ? 'text-primary' : 'text-muted-foreground'
          )} />
          <span className="font-semibold text-sm">Auto-Pilot</span>
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            enabled
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          )}>
            {enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshTasks()}
            disabled={loading}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Refresh tasks"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Toggle */}
      <div className="px-4 py-3 border-b">
        <button
          onClick={toggleEnabled}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors',
            enabled
              ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30'
              : 'bg-muted hover:bg-muted/80 text-foreground'
          )}
        >
          {enabled ? (
            <>
              <Pause className="h-4 w-4" />
              Pause Auto-Pilot
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Auto-Pilot
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          {enabled
            ? 'Tasks will be executed automatically by priority'
            : 'Click to automatically execute tasks on available terminals'
          }
        </p>
      </div>

      {/* Currently Executing */}
      {executingTasks.length > 0 && (
        <div className="px-4 py-3 border-b">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Currently Executing
          </h4>
          <div className="space-y-2">
            {executingTasks.map((task) => (
              <div key={task.taskId} className="bg-primary/5 rounded-lg p-2.5 border border-primary/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.taskTitle}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Terminal className="h-3 w-3" />
                      {task.terminalName}
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {task.commandsCompleted}/{task.commandsTotal}
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar current={task.commandsCompleted} total={task.commandsTotal} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="px-4 py-3 border-b max-h-48 overflow-y-auto">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Queue ({availableTasks.length} tasks)
        </h4>
        {availableTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No tasks with commands available
          </p>
        ) : (
          <div className="space-y-1.5">
            {availableTasks.slice(0, 10).map((task, index) => (
              <div
                key={task.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="text-[10px] text-muted-foreground w-4">{index + 1}.</span>
                <PriorityBadge priority={task.priority as TaskPriority} />
                <span className="text-sm truncate flex-1">{task.title}</span>
              </div>
            ))}
            {availableTasks.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center py-1">
                +{availableTasks.length - 10} more tasks
              </p>
            )}
          </div>
        )}
      </div>

      {/* Terminals */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Terminals ({terminalTabs.length})
        </h4>
        {terminalTabs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No terminals open
          </p>
        ) : (
          <div className="space-y-1">
            {terminalTabs.map((terminal) => {
              const status = getTerminalStatus(terminal.terminalId);
              const executingTask = executingTasks.find(t => t.terminalId === terminal.terminalId);

              return (
                <div
                  key={terminal.terminalId}
                  className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/30"
                >
                  {status === 'executing' ? (
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{terminal.name}</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    status === 'executing'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-green-500/20 text-green-500'
                  )}>
                    {status === 'executing' ? 'Running' : 'Idle'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render in portal
  if (typeof window === 'undefined') return null;
  return createPortal(panelContent, document.body);
}
