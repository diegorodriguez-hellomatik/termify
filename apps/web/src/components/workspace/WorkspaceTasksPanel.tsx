'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronRight, ChevronLeft, GripVertical, CheckSquare, Terminal } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { PersonalTask, TaskPriority, Workspace } from '@/lib/api';
import { PersonalTaskCreateModal } from '@/components/tasks/PersonalTaskCreateModal';
import { useTerminalTasksOptional } from '@/contexts/TerminalTasksContext';
import { cn } from '@/lib/utils';

interface WorkspaceTasksPanelProps {
  tasks: PersonalTask[];
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onCreateTask: (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
    commands?: string[] | null;
  }) => Promise<PersonalTask | null>;
  onTaskClick?: (task: PersonalTask) => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  URGENT: '🔴',
};

// Draggable task card
function DraggableTaskCard({
  task,
  onClick,
  executingTerminal,
}: {
  task: PersonalTask;
  onClick?: () => void;
  executingTerminal?: { terminalName: string; commandsCompleted: number; commandsTotal: number } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const hasCommands = task.commands && JSON.parse(task.commands || '[]').length > 0;

  // Handle native HTML5 drag for compatibility with FloatingTerminal drops
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/task-id', task.id);
    e.dataTransfer.setData('text/plain', task.title);
    e.dataTransfer.setData('application/task-commands', task.commands || '[]');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'group relative p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing',
        'bg-card hover:bg-muted/50 border-border hover:border-muted-foreground/30',
        isDragging && 'shadow-lg ring-2 ring-primary/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab"
        >
          <GripVertical size={14} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{PRIORITY_ICONS[task.priority as TaskPriority]}</span>
            <span className="text-sm font-medium truncate">{task.title}</span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            <span className={cn(
              'px-1.5 py-0.5 rounded-full',
              task.status === 'done' ? 'bg-green-500/20 text-green-500' :
              task.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-500' :
              'bg-muted'
            )}>
              {task.status.replace('_', ' ')}
            </span>
            {hasCommands && !executingTerminal && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                has commands
              </span>
            )}
            {executingTerminal && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                <Terminal size={10} />
                <span className="truncate max-w-[80px]" title={executingTerminal.terminalName}>
                  {executingTerminal.terminalName}
                </span>
                <span className="text-blue-400">
                  {executingTerminal.commandsCompleted}/{executingTerminal.commandsTotal}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceTasksPanel({
  tasks,
  workspaces,
  currentWorkspaceId,
  isOpen,
  onToggle,
  onCreateTask,
  onTaskClick,
}: WorkspaceTasksPanelProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Get executing tasks info from context
  const terminalTasksContext = useTerminalTasksOptional();

  // Helper to get terminal info for a task
  const getExecutingTerminal = (taskId: string) => {
    if (!terminalTasksContext) return null;
    const info = terminalTasksContext.getTerminalForTask(taskId);
    if (!info) return null;
    return {
      terminalName: info.terminalName,
      commandsCompleted: info.commandsCompleted,
      commandsTotal: info.commandsTotal,
    };
  };

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onToggle();
    }, 200); // Match the duration-200 animation
  }, [onToggle]);

  // Filter tasks by status
  const todoTasks = tasks.filter(t => t.status === 'todo' || t.status === 'backlog');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'in_review');

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
    commands?: string[] | null;
  }) => {
    // Force the task to be created in the current workspace
    return onCreateTask({
      ...data,
      workspaceId: currentWorkspaceId,
    });
  };

  // Collapsed state - just show toggle button at bottom
  if (!isOpen && !shouldRender) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1 px-2 py-3 bg-card border border-border border-r-0 rounded-l-lg shadow-lg hover:bg-muted transition-colors"
        title="Open tasks panel"
      >
        <CheckSquare size={16} className="text-primary" />
        <ChevronLeft size={14} />
        {tasks.length > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {tasks.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <div className={cn(
        "fixed right-0 top-0 bottom-0 w-72 bg-background border-l border-border shadow-xl z-40 flex flex-col",
        isClosing
          ? "animate-out slide-out-to-right duration-200"
          : "animate-in slide-in-from-right duration-200"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">Tasks</h3>
            <span className="text-xs text-muted-foreground">({tasks.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCreateModalOpen(true)}
              title="Create task"
            >
              <Plus size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClose}
              title="Close panel"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        {/* Task lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckSquare size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                No tasks in this workspace
              </p>
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="gap-1.5"
              >
                <Plus size={14} />
                Create Task
              </Button>
            </div>
          ) : (
            <>
              {/* To Do */}
              {todoTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    To Do ({todoTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {todoTasks.map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        executingTerminal={getExecutingTerminal(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress */}
              {inProgressTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    In Progress ({inProgressTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {inProgressTasks.map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        executingTerminal={getExecutingTerminal(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              {doneTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Done ({doneTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {doneTasks.map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        executingTerminal={getExecutingTerminal(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            Drag tasks with commands to a terminal to execute
          </p>
        </div>
      </div>

      {/* Create Task Modal */}
      <PersonalTaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
        workspaces={workspaces}
        defaultWorkspaceId={currentWorkspaceId}
      />
    </>
  );
}
