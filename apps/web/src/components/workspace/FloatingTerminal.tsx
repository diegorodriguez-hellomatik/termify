'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';
import dynamic from 'next/dynamic';
import { X, Minus, Maximize2, Minimize2, Loader2, Settings, Trash2, Pencil, ListChecks, Play, ChevronDown, Zap } from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { cn } from '@/lib/utils';
import { TerminalSettingsModal, TerminalSettings } from '@/components/terminal/TerminalSettingsModal';
import { terminalsApi, personalTasksApi, PersonalTask } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSession } from 'next-auth/react';
import { usePersonalTasksSocket } from '@/hooks/usePersonalTasksSocket';
import { useTerminalTasksOptional } from '@/contexts/TerminalTasksContext';

// Dynamic import to avoid SSR issues with xterm
const Terminal = dynamic(
  () => import('@/components/terminal/Terminal').then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface FloatingTerminalProps {
  id: string;
  terminalId: string;
  token: string;
  name: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  zIndex: number;
  /** Whether user has customized position/size - if false, syncs with parent */
  isCustomized?: boolean;
  /** Whether the layout is locked (prevents moving/resizing) */
  isLocked?: boolean;
  /** Initial display settings from database */
  initialSettings?: {
    fontSize?: number | null;
    fontFamily?: string | null;
    theme?: string | null;
  };
  onFocus: () => void;
  onClose: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
}

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

export function FloatingTerminal({
  id,
  terminalId,
  token,
  name,
  initialPosition = { x: 50, y: 50 },
  initialSize = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  zIndex,
  isCustomized = false,
  isLocked = false,
  initialSettings,
  onFocus,
  onClose,
  onPositionChange,
  onSizeChange,
}: FloatingTerminalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [preMaximizeState, setPreMaximizeState] = useState<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Drop zone state for tasks
  const [isDropTarget, setIsDropTarget] = useState(false);
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Tasks panel state
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [executableTasks, setExecutableTasks] = useState<PersonalTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const tasksPanelRef = useRef<HTMLDivElement>(null);

  // Executing task state (for showing which task this terminal is working on)
  const [executingTask, setExecutingTask] = useState<{
    id: string;
    title: string;
    queueId: string;
    commandsTotal: number;
    commandsCompleted: number;
  } | null>(null);

  // Global terminal-task tracking context (optional - may not be available)
  const terminalTasksContext = useTerminalTasksOptional();

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { renameTerminal } = useWorkspace();

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Rename handlers
  const handleStartRename = useCallback(() => {
    setRenameValue(name);
    setIsRenaming(true);
  }, [name]);

  const handleRenameSubmit = useCallback(async () => {
    if (renameValue.trim() && renameValue.trim() !== name) {
      await renameTerminal(terminalId, renameValue.trim());
    }
    setIsRenaming(false);
  }, [renameValue, name, renameTerminal, terminalId]);

  const handleRenameCancel = useCallback(() => {
    setRenameValue(name);
    setIsRenaming(false);
  }, [name]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Terminal settings (per-terminal configuration)
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>({
    fontSize: initialSettings?.fontSize ?? 14,
    fontFamily: initialSettings?.fontFamily ?? 'JetBrains Mono, monospace',
    theme: initialSettings?.theme ?? undefined,
  });

  // Save settings to database
  const saveSettings = useCallback(async (newSettings: TerminalSettings) => {
    setTerminalSettings(newSettings);
    try {
      await terminalsApi.update(
        terminalId,
        {
          fontSize: newSettings.fontSize,
          fontFamily: newSettings.fontFamily,
          theme: newSettings.theme ?? null,
        },
        token
      );
    } catch (error) {
      console.error('Failed to save terminal settings:', error);
    }
  }, [terminalId, token]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  // Sync position/size with parent when not customized (e.g., when grid recalculates)
  useEffect(() => {
    if (!isCustomized && !isMaximized) {
      setPosition(initialPosition);
      setSize(initialSize);
    }
  }, [initialPosition.x, initialPosition.y, initialSize.width, initialSize.height, isCustomized, isMaximized]);

  // Terminal status tracking
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>(TerminalStatus.STOPPED);
  const [isConnected, setIsConnected] = useState(false);

  const handleStatusUpdate = useCallback((status: TerminalStatus, connected: boolean) => {
    setTerminalStatus(status);
    setIsConnected(connected);
  }, []);

  // Status color mapping
  const getStatusColor = (status: TerminalStatus) => {
    switch (status) {
      case TerminalStatus.RUNNING:
        return 'bg-green-500';
      case TerminalStatus.STARTING:
        return 'bg-yellow-500 animate-pulse';
      case TerminalStatus.CRASHED:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: TerminalStatus) => {
    switch (status) {
      case TerminalStatus.RUNNING:
        return 'Running';
      case TerminalStatus.STARTING:
        return 'Starting...';
      case TerminalStatus.CRASHED:
        return 'Crashed';
      default:
        return 'Stopped';
    }
  };

  // Get parent container dimensions
  const getContainerBounds = useCallback(() => {
    if (containerRef.current?.parentElement) {
      const parent = containerRef.current.parentElement;
      return {
        width: parent.clientWidth,
        height: parent.clientHeight,
      };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }, []);

  const handleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore
      if (preMaximizeState) {
        setPosition(preMaximizeState.position);
        setSize(preMaximizeState.size);
      }
      setIsMaximized(false);
    } else {
      // Maximize
      setPreMaximizeState({ position, size });
      const bounds = getContainerBounds();
      setPosition({ x: 0, y: 0 });
      setSize({ width: bounds.width, height: bounds.height });
      setIsMaximized(true);
    }
  }, [isMaximized, position, size, preMaximizeState, getContainerBounds]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  // Snap functions for Windows-style window management
  const handleSnapLeft = useCallback(() => {
    const bounds = getContainerBounds();
    setPreMaximizeState({ position, size });
    setPosition({ x: 0, y: 0 });
    setSize({ width: Math.floor(bounds.width / 2), height: bounds.height });
    setIsMaximized(false);
    onPositionChange?.({ x: 0, y: 0 });
    onSizeChange?.({ width: Math.floor(bounds.width / 2), height: bounds.height });
  }, [position, size, getContainerBounds, onPositionChange, onSizeChange]);

  const handleSnapRight = useCallback(() => {
    const bounds = getContainerBounds();
    const newWidth = Math.floor(bounds.width / 2);
    setPreMaximizeState({ position, size });
    setPosition({ x: newWidth, y: 0 });
    setSize({ width: newWidth, height: bounds.height });
    setIsMaximized(false);
    onPositionChange?.({ x: newWidth, y: 0 });
    onSizeChange?.({ width: newWidth, height: bounds.height });
  }, [position, size, getContainerBounds, onPositionChange, onSizeChange]);

  const handleSnapUp = useCallback(() => {
    // Maximize
    if (!isMaximized) {
      setPreMaximizeState({ position, size });
      const bounds = getContainerBounds();
      setPosition({ x: 0, y: 0 });
      setSize({ width: bounds.width, height: bounds.height });
      setIsMaximized(true);
      onPositionChange?.({ x: 0, y: 0 });
      onSizeChange?.({ width: bounds.width, height: bounds.height });
    }
  }, [isMaximized, position, size, getContainerBounds, onPositionChange, onSizeChange]);

  const handleSnapDown = useCallback(() => {
    // Restore from maximized or snap, or minimize if already restored
    if (isMaximized || preMaximizeState) {
      if (preMaximizeState) {
        setPosition(preMaximizeState.position);
        setSize(preMaximizeState.size);
        onPositionChange?.(preMaximizeState.position);
        onSizeChange?.(preMaximizeState.size);
      }
      setIsMaximized(false);
      setPreMaximizeState(null);
    } else {
      // Already in normal state - minimize
      setIsMinimized(true);
    }
  }, [isMaximized, preMaximizeState, onPositionChange, onSizeChange]);

  // Track if this window is focused
  const [isFocused, setIsFocused] = useState(false);

  // Handle keyboard shortcuts for window snapping
  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            handleSnapLeft();
            break;
          case 'ArrowRight':
            e.preventDefault();
            handleSnapRight();
            break;
          case 'ArrowUp':
            e.preventDefault();
            handleSnapUp();
            break;
          case 'ArrowDown':
            e.preventDefault();
            handleSnapDown();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, handleSnapLeft, handleSnapRight, handleSnapUp, handleSnapDown]);

  // Set focus when onFocus is called
  const handleWindowFocus = useCallback(() => {
    setIsFocused(true);
    onFocus();
  }, [onFocus]);

  // Blur when clicking outside (handled by other windows gaining focus)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const handleDragStop = useCallback(
    (_e: any, d: { x: number; y: number }) => {
      if (!isMaximized) {
        // Clamp position: prevent going too far left/up, but allow free movement down/right
        const clampedX = Math.max(-size.width + 100, d.x); // Keep at least 100px visible on left
        const clampedY = Math.max(0, d.y); // Don't go above the container
        setPosition({ x: clampedX, y: clampedY });
        onPositionChange?.({ x: clampedX, y: clampedY });
      }
    },
    [isMaximized, onPositionChange, size.width]
  );

  const handleResizeStop = useCallback(
    (
      _e: any,
      _direction: any,
      ref: HTMLElement,
      _delta: any,
      newPosition: { x: number; y: number }
    ) => {
      if (!isMaximized) {
        const newSize = {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
        };
        // Clamp position after resize
        const clampedX = Math.max(-newSize.width + 100, newPosition.x);
        const clampedY = Math.max(0, newPosition.y);
        const clampedPosition = { x: clampedX, y: clampedY };

        setSize(newSize);
        setPosition(clampedPosition);
        onSizeChange?.(newSize);
        onPositionChange?.(clampedPosition);
      }
    },
    [isMaximized, onSizeChange, onPositionChange]
  );

  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute bottom-4 left-4 bg-card border border-border rounded-lg shadow-lg cursor-pointer hover:bg-muted transition-colors",
          executingTask && "border-primary/50"
        )}
        style={{ zIndex }}
        onClick={() => {
          setIsMinimized(false);
          handleWindowFocus();
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className={cn('w-2 h-2 rounded-full', getStatusColor(terminalStatus))} />
          <span className="text-sm font-medium truncate max-w-[150px]">{name}</span>
          {executingTask ? (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Zap size={12} className="animate-pulse" />
              <span className="truncate max-w-[100px]">{executingTask.title}</span>
              <span className="text-primary/70">{executingTask.commandsCompleted}/{executingTask.commandsTotal}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{getStatusLabel(terminalStatus)}</span>
          )}
          <Maximize2 size={14} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Track if we're animating (to disable during user interaction)
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle task drop for execution
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/task-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDropTarget(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);

    const taskId = e.dataTransfer.getData('application/task-id');
    const taskTitle = e.dataTransfer.getData('text/plain');
    const taskCommandsJson = e.dataTransfer.getData('application/task-commands');

    if (!taskId || !accessToken) return;

    // Check if task has commands
    let commands: string[] = [];
    try {
      commands = taskCommandsJson ? JSON.parse(taskCommandsJson) as string[] : [];
    } catch {
      commands = [];
    }

    try {
      if (commands.length > 0) {
        // Task has commands - execute them in the terminal
        const response = await personalTasksApi.execute(taskId, { terminalId }, accessToken);
        if (response.success && response.data) {
          console.log(`[FloatingTerminal] Task "${taskTitle}" sent to terminal - Executing ${response.data.queue.commands.length} commands`);
          // Track executing task locally
          const taskInfo = {
            id: taskId,
            title: taskTitle,
            queueId: response.data.queue.id,
            commandsTotal: response.data.queue.commands.length,
            commandsCompleted: 0,
          };
          setExecutingTask(taskInfo);
          // Register in global context
          terminalTasksContext?.registerExecution({
            taskId,
            taskTitle,
            queueId: response.data.queue.id,
            terminalId,
            terminalName: name,
            commandsTotal: response.data.queue.commands.length,
            commandsCompleted: 0,
            startedAt: new Date(),
          });
        } else {
          console.error('[FloatingTerminal] Failed to execute task:', typeof response.error === 'string' ? response.error : 'Unknown error');
        }
      } else {
        // Task has no commands - just mark as in_progress
        const response = await personalTasksApi.update(taskId, { status: 'in_progress' }, accessToken);
        if (response.success) {
          console.log(`[FloatingTerminal] Task "${taskTitle}" marked as in progress`);
        } else {
          console.error('[FloatingTerminal] Failed to update task:', typeof response.error === 'string' ? response.error : 'Unknown error');
        }
      }
    } catch (error) {
      console.error('[FloatingTerminal] Error executing task:', error);
    }
  }, [accessToken, terminalId, name, terminalTasksContext]);

  // Load tasks for the tasks panel (all tasks, not just those with commands)
  const loadExecutableTasks = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTasks(true);
    try {
      const response = await personalTasksApi.list(accessToken);
      if (response.success && response.data) {
        // Show all pending tasks (not done)
        const pendingTasks = response.data.tasks.filter((task: PersonalTask) =>
          task.status !== 'done' && task.status !== 'in_review'
        );
        setExecutableTasks(pendingTasks);
      }
    } catch (error) {
      console.error('[FloatingTerminal] Error loading tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  }, [accessToken]);

  // Execute a task from the panel
  const handleExecuteTask = useCallback(async (task: PersonalTask) => {
    if (!accessToken) return;
    setShowTasksPanel(false);

    // Check if task has commands
    let commands: string[] = [];
    try {
      commands = task.commands ? JSON.parse(task.commands) as string[] : [];
    } catch {
      commands = [];
    }

    try {
      if (commands.length > 0) {
        // Task has commands - execute them in the terminal
        const response = await personalTasksApi.execute(task.id, { terminalId }, accessToken);
        if (response.success && response.data) {
          console.log(`[FloatingTerminal] Task "${task.title}" executed - ${response.data.queue.commands.length} commands`);
          // Track executing task locally
          setExecutingTask({
            id: task.id,
            title: task.title,
            queueId: response.data.queue.id,
            commandsTotal: response.data.queue.commands.length,
            commandsCompleted: 0,
          });
          // Register in global context
          terminalTasksContext?.registerExecution({
            taskId: task.id,
            taskTitle: task.title,
            queueId: response.data.queue.id,
            terminalId,
            terminalName: name,
            commandsTotal: response.data.queue.commands.length,
            commandsCompleted: 0,
            startedAt: new Date(),
          });
        } else {
          console.error('[FloatingTerminal] Failed to execute task:', response.error);
        }
      } else {
        // Task has no commands - just mark as in_progress
        const response = await personalTasksApi.update(task.id, { status: 'in_progress' }, accessToken);
        if (response.success) {
          console.log(`[FloatingTerminal] Task "${task.title}" marked as in progress`);
        } else {
          console.error('[FloatingTerminal] Failed to update task:', response.error);
        }
      }
    } catch (error) {
      console.error('[FloatingTerminal] Error executing task:', error);
    }
  }, [accessToken, terminalId, name, terminalTasksContext]);

  // Toggle tasks panel
  const handleToggleTasksPanel = useCallback(() => {
    if (!showTasksPanel) {
      loadExecutableTasks();
    }
    setShowTasksPanel(!showTasksPanel);
  }, [showTasksPanel, loadExecutableTasks]);

  // Close tasks panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tasksPanelRef.current && !tasksPanelRef.current.contains(event.target as Node)) {
        setShowTasksPanel(false);
      }
    };
    if (showTasksPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTasksPanel]);

  // WebSocket callbacks to track queue events for this terminal
  const socketCallbacks = {
    onQueueCompleted: useCallback((event: { queueId: string; taskId?: string }) => {
      if (executingTask && event.queueId === executingTask.queueId) {
        console.log(`[FloatingTerminal ${terminalId}] Task "${executingTask.title}" completed`);
        setExecutingTask(null);
        terminalTasksContext?.clearExecution(event.queueId);
      }
    }, [executingTask, terminalId, terminalTasksContext]),
    onQueueFailed: useCallback((event: { queueId: string; taskId?: string; reason?: string }) => {
      if (executingTask && event.queueId === executingTask.queueId) {
        console.log(`[FloatingTerminal ${terminalId}] Task "${executingTask.title}" failed:`, event.reason);
        setExecutingTask(null);
        terminalTasksContext?.clearExecution(event.queueId);
      }
    }, [executingTask, terminalId, terminalTasksContext]),
    onQueueCancelled: useCallback((event: { queueId: string; taskId?: string }) => {
      if (executingTask && event.queueId === executingTask.queueId) {
        console.log(`[FloatingTerminal ${terminalId}] Task "${executingTask.title}" cancelled`);
        setExecutingTask(null);
        terminalTasksContext?.clearExecution(event.queueId);
      }
    }, [executingTask, terminalId, terminalTasksContext]),
    onQueueCommandCompleted: useCallback((event: { queueId: string; commandId: string; exitCode: number }) => {
      if (executingTask && event.queueId === executingTask.queueId) {
        const newCompleted = executingTask.commandsCompleted + 1;
        setExecutingTask(prev => prev ? {
          ...prev,
          commandsCompleted: newCompleted,
        } : null);
        terminalTasksContext?.updateProgress(event.queueId, newCompleted);
      }
    }, [executingTask, terminalTasksContext]),
  };

  // Connect to WebSocket for queue events
  usePersonalTasksSocket({
    token: accessToken || null,
    callbacks: socketCallbacks,
  });

  // Trigger animation when position/size changes from parent (not user interaction)
  useEffect(() => {
    if (!isCustomized && !isMaximized) {
      setIsAnimating(true);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [initialPosition.x, initialPosition.y, initialSize.width, initialSize.height, isCustomized, isMaximized]);

  return (
    <Rnd
      position={position}
      size={size}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      dragHandleClassName="floating-terminal-handle"
      enableResizing={!isMaximized && !isLocked}
      disableDragging={isMaximized || isLocked}
      onDragStart={() => { setIsAnimating(false); handleWindowFocus(); }}
      onDragStop={handleDragStop}
      onResizeStart={() => { setIsAnimating(false); handleWindowFocus(); }}
      onResizeStop={handleResizeStop}
      style={{
        zIndex,
        transition: isAnimating ? 'transform 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out' : 'none',
      }}
      resizeHandleStyles={{
        top: { cursor: 'ns-resize' },
        bottom: { cursor: 'ns-resize' },
        left: { cursor: 'ew-resize' },
        right: { cursor: 'ew-resize' },
        topLeft: { cursor: 'nwse-resize' },
        topRight: { cursor: 'nesw-resize' },
        bottomLeft: { cursor: 'nesw-resize' },
        bottomRight: { cursor: 'nwse-resize' },
      }}
      resizeHandleComponent={{
        bottomRight: (
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize">
            <svg
              className="absolute bottom-1 right-1 w-2 h-2 text-muted-foreground"
              viewBox="0 0 6 6"
            >
              <path
                d="M 6 0 L 6 6 L 0 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          </div>
        ),
      }}
    >
      <div
        ref={containerRef}
        className={cn(
          'h-full w-full flex flex-col bg-card border border-border rounded-lg shadow-xl overflow-hidden',
          'ring-0 focus-within:ring-2 focus-within:ring-primary/50',
          isDropTarget && 'ring-2 ring-primary border-primary'
        )}
        onMouseDown={handleWindowFocus}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop indicator */}
        {isDropTarget && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg">
              <ListChecks className="h-5 w-5" />
              <span className="font-medium">Drop to execute task</span>
            </div>
          </div>
        )}

        {/* Window title bar - compact with status */}
        <div className={cn(
          "floating-terminal-handle flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border select-none",
          isLocked ? "cursor-default" : "cursor-move"
        )}>
          <div className="flex items-center gap-3">
            {/* Terminal name with status indicator */}
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', getStatusColor(terminalStatus))} />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={handleRenameSubmit}
                  className="text-sm font-medium bg-transparent border-none outline-none w-[150px] focus:ring-1 focus:ring-primary rounded px-1"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-sm font-medium truncate max-w-[150px] cursor-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename();
                  }}
                  title="Double-click to rename"
                >
                  {name}
                </span>
              )}
            </div>

            {/* Status label */}
            <span className="text-xs text-muted-foreground">
              {getStatusLabel(terminalStatus)}
            </span>

            {/* Connection status */}
            <span className={cn(
              'text-xs',
              isConnected ? 'text-green-500' : 'text-muted-foreground'
            )}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>

            {/* Executing task indicator */}
            {executingTask && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                <Zap size={12} className="animate-pulse" />
                <span className="text-xs font-medium truncate max-w-[120px]" title={executingTask.title}>
                  {executingTask.title}
                </span>
                <span className="text-[10px] text-primary/70">
                  {executingTask.commandsCompleted}/{executingTask.commandsTotal}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Tasks button */}
            <div className="relative" ref={tasksPanelRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTasksPanel();
                }}
                className={cn(
                  "p-1 rounded hover:bg-muted transition-colors",
                  showTasksPanel && "bg-muted"
                )}
                title="Execute Task"
              >
                <ListChecks size={14} className="text-muted-foreground" />
              </button>

              {/* Tasks dropdown panel */}
              {showTasksPanel && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-background border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b bg-muted/50">
                    <span className="text-xs font-medium">Execute Task</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {loadingTasks ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : executableTasks.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No pending tasks
                      </div>
                    ) : (
                      executableTasks.map((task) => {
                        let commands: string[] = [];
                        try {
                          commands = task.commands ? JSON.parse(task.commands) as string[] : [];
                        } catch {
                          commands = [];
                        }
                        const hasCommands = commands.length > 0;
                        return (
                          <button
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExecuteTask(task);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2"
                          >
                            <Play size={14} className={cn("mt-0.5 flex-shrink-0", hasCommands ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{task.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {hasCommands
                                  ? `${commands.length} command${commands.length !== 1 ? 's' : ''}`
                                  : 'No commands - will mark as in progress'
                                }
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsModal(true);
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Terminal Settings"
            >
              <Settings size={14} className="text-muted-foreground" />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMinimize();
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Minimize"
            >
              <Minus size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMaximize();
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 size={14} className="text-muted-foreground" />
              ) : (
                <Maximize2 size={14} className="text-muted-foreground" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded hover:bg-destructive/20 transition-colors"
              title="Close"
            >
              <X size={14} className="text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Terminal
            terminalId={terminalId}
            token={token}
            className="h-full"
            hideToolbar={true}
            onStatusUpdate={handleStatusUpdate}
            fontSize={terminalSettings.fontSize}
            fontFamily={terminalSettings.fontFamily}
            themeOverride={terminalSettings.theme}
          />
        </div>

        {/* Context Menu */}
        {contextMenu && typeof window !== 'undefined' && createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={closeContextMenu}
              onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
            />
            {/* Menu */}
            <div
              className="fixed z-[9999] min-w-[140px] py-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in duration-75"
              style={{
                top: contextMenu.y,
                left: contextMenu.x,
              }}
            >
              <button
                onClick={() => {
                  closeContextMenu();
                  handleStartRename();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
              >
                <Pencil size={14} className="text-muted-foreground" />
                Rename
              </button>
              <button
                onClick={() => {
                  closeContextMenu();
                  setShowSettingsModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
              >
                <Settings size={14} className="text-muted-foreground" />
                Settings
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  closeContextMenu();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors duration-75"
              >
                <Trash2 size={14} />
                Close Terminal
              </button>
            </div>
          </>,
          document.body
        )}

        {/* Settings Modal - rendered in portal to appear centered on screen */}
        {showSettingsModal && typeof window !== 'undefined' && createPortal(
          <TerminalSettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            terminalName={name}
            settings={terminalSettings}
            onSave={saveSettings}
          />,
          document.body
        )}
      </div>
    </Rnd>
  );
}
