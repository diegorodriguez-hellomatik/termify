'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import dynamic from 'next/dynamic';
import { X, Minus, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { cn } from '@/lib/utils';

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
        className="absolute bottom-4 left-4 bg-card border border-border rounded-lg shadow-lg cursor-pointer hover:bg-muted transition-colors"
        style={{ zIndex }}
        onClick={() => {
          setIsMinimized(false);
          handleWindowFocus();
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div className={cn('w-2 h-2 rounded-full', getStatusColor(terminalStatus))} />
          <span className="text-sm font-medium truncate max-w-[150px]">{name}</span>
          <span className="text-xs text-muted-foreground">{getStatusLabel(terminalStatus)}</span>
          <Maximize2 size={14} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Track if we're animating (to disable during user interaction)
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      enableResizing={!isMaximized}
      disableDragging={isMaximized}
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
          'ring-0 focus-within:ring-2 focus-within:ring-primary/50'
        )}
        onMouseDown={handleWindowFocus}
      >
        {/* Window title bar - compact with status */}
        <div className="floating-terminal-handle flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border cursor-move select-none">
          <div className="flex items-center gap-3">
            {/* Terminal name with status indicator */}
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', getStatusColor(terminalStatus))} />
              <span className="text-sm font-medium truncate max-w-[150px]">{name}</span>
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
          </div>

          <div className="flex items-center gap-1">
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
          />
        </div>
      </div>
    </Rnd>
  );
}
