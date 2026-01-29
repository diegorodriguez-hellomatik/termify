'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, SplitSquareHorizontal, SplitSquareVertical, Maximize2, Loader2 } from 'lucide-react';
import { PaneNode, useWorkspace } from '@/contexts/WorkspaceContext';
import { FileViewer } from '@/components/files/FileViewer';
import { DroppablePane } from './DroppablePane';
import { cn } from '@/lib/utils';

// Dynamic import to avoid SSR issues with xterm.js
const Terminal = dynamic(
  () => import('@/components/terminal/Terminal').then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface SplitPaneProps {
  node: PaneNode;
  token: string;
  isDark: boolean;
  activeTerminalId?: string; // For file viewer context
  onSplitHorizontal?: (terminalId: string) => void;
  onSplitVertical?: (terminalId: string) => void;
  onTabDrop?: (paneId: string, terminalId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
  depth?: number;
}

export function SplitPane({
  node,
  token,
  isDark,
  activeTerminalId,
  onSplitHorizontal,
  onSplitVertical,
  depth = 0,
}: SplitPaneProps) {
  const { closePane, updatePaneSizes, splitPane } = useWorkspace();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>(node.sizes || [50, 50]);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeIndex, setResizeIndex] = useState(0);

  // Update sizes when node changes
  useEffect(() => {
    if (node.sizes) {
      setSizes(node.sizes);
    }
  }, [node.sizes]);

  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeIndex(index);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current || !node.children) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const isHorizontal = node.direction === 'horizontal';

      const position = isHorizontal
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;

      // Calculate new sizes
      const newSizes = [...sizes];
      const minSize = 20; // Minimum 20%

      // Calculate the position relative to previous panes
      let previousTotal = 0;
      for (let i = 0; i < resizeIndex; i++) {
        previousTotal += sizes[i];
      }

      const newFirstSize = Math.max(minSize, Math.min(100 - minSize, position - previousTotal));
      const diff = newFirstSize - sizes[resizeIndex];

      newSizes[resizeIndex] = newFirstSize;
      newSizes[resizeIndex + 1] = Math.max(minSize, sizes[resizeIndex + 1] - diff);

      setSizes(newSizes);
    },
    [isResizing, node.direction, node.children, sizes, resizeIndex]
  );

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      updatePaneSizes(node.id, sizes);
    }
  }, [isResizing, node.id, sizes, updatePaneSizes]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Render terminal pane
  if (node.type === 'terminal' && node.terminalId) {
    return (
      <div className="h-full w-full relative group">
        {/* Pane toolbar */}
        <div
          className={cn(
            'absolute top-0 right-0 z-20 flex items-center gap-1 p-1 rounded-bl-lg transition-opacity',
            'opacity-0 group-hover:opacity-100',
            isDark ? 'bg-black/50' : 'bg-white/50'
          )}
        >
          <button
            onClick={() => onSplitHorizontal?.(node.terminalId!)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Split horizontal"
          >
            <SplitSquareHorizontal size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => onSplitVertical?.(node.terminalId!)}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Split vertical"
          >
            <SplitSquareVertical size={14} className="text-muted-foreground" />
          </button>
          {depth > 0 && (
            <button
              onClick={() => closePane(node.id)}
              className="p-1 rounded hover:bg-destructive/20 transition-colors"
              title="Close pane"
            >
              <X size={14} className="text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>

        <Terminal
          key={node.terminalId}
          terminalId={node.terminalId}
          token={token}
          className="h-full"
        />
      </div>
    );
  }

  // Render file pane
  if (node.type === 'file' && node.filePath) {
    // Use the activeTerminalId to fetch file content
    const terminalId = activeTerminalId || node.terminalId;
    if (!terminalId) {
      return (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          No terminal context available
        </div>
      );
    }

    return (
      <div className="h-full w-full relative group">
        {/* Pane toolbar */}
        <div
          className={cn(
            'absolute top-0 right-0 z-20 flex items-center gap-1 p-1 rounded-bl-lg transition-opacity',
            'opacity-0 group-hover:opacity-100',
            isDark ? 'bg-black/50' : 'bg-white/50'
          )}
        >
          {depth > 0 && (
            <button
              onClick={() => closePane(node.id)}
              className="p-1 rounded hover:bg-destructive/20 transition-colors"
              title="Close pane"
            >
              <X size={14} className="text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>

        <FileViewer
          terminalId={terminalId}
          filePath={node.filePath}
          fileName={node.fileName || node.filePath.split('/').pop() || 'file'}
          extension={node.fileExtension}
          className="h-full"
        />
      </div>
    );
  }

  // Render split pane
  if (node.type === 'split' && node.children && node.children.length > 0) {
    const isHorizontal = node.direction === 'horizontal';

    return (
      <div
        ref={containerRef}
        className={cn(
          'h-full w-full flex',
          isHorizontal ? 'flex-row' : 'flex-col',
          isResizing && 'select-none'
        )}
      >
        {node.children.map((child, index) => (
          <div key={child.id} className="flex" style={{ flex: `0 0 ${sizes[index] || 50}%` }}>
            {/* Child pane */}
            <div className="flex-1 min-w-0 min-h-0">
              <SplitPane
                node={child}
                token={token}
                isDark={isDark}
                activeTerminalId={activeTerminalId}
                onSplitHorizontal={onSplitHorizontal}
                onSplitVertical={onSplitVertical}
                depth={depth + 1}
              />
            </div>

            {/* Resize handle */}
            {node.children && index < node.children.length - 1 && (
              <div
                onMouseDown={handleMouseDown(index)}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isHorizontal
                    ? 'w-1 cursor-col-resize hover:bg-primary/50'
                    : 'h-1 cursor-row-resize hover:bg-primary/50',
                  isResizing && resizeIndex === index && 'bg-primary',
                  isDark ? 'bg-border' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
