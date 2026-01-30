'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FloatingTerminal } from './FloatingTerminal';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';
import { FloatingWindowPosition } from '@/lib/api';

interface WindowState {
  id: string;
  terminalId: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isCustomized: boolean;
}

interface FloatingWorkspaceProps {
  token: string;
}

const BASE_Z_INDEX = 10;
const GAP = 4;

// Calculate optimal grid layout based on number of windows
function calculateGridLayout(count: number, containerWidth: number, containerHeight: number): {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
} {
  if (count === 0) return { cols: 1, rows: 1, cellWidth: containerWidth, cellHeight: containerHeight };

  if (count === 1) {
    return { cols: 1, rows: 1, cellWidth: containerWidth - GAP * 2, cellHeight: containerHeight - GAP * 2 };
  }

  if (count === 2) {
    return {
      cols: 2,
      rows: 1,
      cellWidth: (containerWidth - GAP * 3) / 2,
      cellHeight: containerHeight - GAP * 2,
    };
  }

  if (count === 3 || count === 4) {
    return {
      cols: 2,
      rows: 2,
      cellWidth: (containerWidth - GAP * 3) / 2,
      cellHeight: (containerHeight - GAP * 3) / 2,
    };
  }

  if (count === 5 || count === 6) {
    return {
      cols: 3,
      rows: 2,
      cellWidth: (containerWidth - GAP * 4) / 3,
      cellHeight: (containerHeight - GAP * 3) / 2,
    };
  }

  if (count <= 9) {
    return {
      cols: 3,
      rows: 3,
      cellWidth: (containerWidth - GAP * 4) / 3,
      cellHeight: (containerHeight - GAP * 4) / 3,
    };
  }

  const aspectRatio = containerWidth / containerHeight;
  let cols = Math.ceil(Math.sqrt(count * aspectRatio));
  let rows = Math.ceil(count / cols);

  while (cols * rows < count) {
    if (cols <= rows) cols++;
    else rows++;
  }

  return {
    cols,
    rows,
    cellWidth: (containerWidth - GAP * (cols + 1)) / cols,
    cellHeight: (containerHeight - GAP * (rows + 1)) / rows,
  };
}

function getGridPosition(
  index: number,
  cols: number,
  cellWidth: number,
  cellHeight: number
): { x: number; y: number; width: number; height: number } {
  const row = Math.floor(index / cols);
  const col = index % cols;

  return {
    x: GAP + col * (cellWidth + GAP),
    y: GAP + row * (cellHeight + GAP),
    width: cellWidth,
    height: cellHeight,
  };
}

export function FloatingWorkspace({ token }: FloatingWorkspaceProps) {
  const { tabs, closeTab, floatingLayout, updateFloatingLayout } = useWorkspace();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [topZIndex, setTopZIndex] = useState(BASE_Z_INDEX);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Sync windows with tabs and calculate grid positions
  useEffect(() => {
    const terminalTabs = tabs.filter((tab): tab is Tab & { terminalId: string } =>
      tab.type === 'terminal' && !!tab.terminalId
    );

    if (containerSize.width === 0 || containerSize.height === 0) return;

    const { cols, cellWidth, cellHeight } = calculateGridLayout(
      terminalTabs.length,
      containerSize.width,
      containerSize.height
    );

    // Check if we have saved positions from the server
    const savedPositions = floatingLayout?.windows || [];
    const savedPositionsMap = new Map(
      savedPositions.map(w => [w.terminalId, w])
    );

    setWindows((prevWindows) => {
      const existingWindows = new Map(prevWindows.map(w => [w.terminalId, w]));
      const prevCount = prevWindows.length;
      const newCount = terminalTabs.length;
      const countChanged = prevCount !== newCount;

      const newWindows: WindowState[] = terminalTabs.map((tab, index) => {
        const existing = existingWindows.get(tab.terminalId);
        const saved = savedPositionsMap.get(tab.terminalId);
        const gridPos = getGridPosition(index, cols, cellWidth, cellHeight);

        // If window exists and is customized, keep it as is
        if (existing && existing.isCustomized) {
          return {
            ...existing,
            name: tab.name,
          };
        }

        // If window exists but NOT customized and terminal count changed,
        // recalculate its position/size based on the new grid
        if (existing && !existing.isCustomized && countChanged) {
          return {
            ...existing,
            name: tab.name,
            position: { x: gridPos.x, y: gridPos.y },
            size: { width: gridPos.width, height: gridPos.height },
          };
        }

        // If window exists and count didn't change, keep it
        if (existing) {
          return {
            ...existing,
            name: tab.name,
          };
        }

        // Check saved positions from server (only if customized)
        if (saved && saved.isCustomized) {
          return {
            id: tab.id,
            terminalId: tab.terminalId,
            name: tab.name,
            position: { x: saved.x, y: saved.y },
            size: { width: saved.width, height: saved.height },
            zIndex: saved.zIndex || topZIndex + index + 1,
            isCustomized: true,
          };
        }

        // New window - use grid position
        return {
          id: tab.id,
          terminalId: tab.terminalId,
          name: tab.name,
          position: { x: gridPos.x, y: gridPos.y },
          size: { width: gridPos.width, height: gridPos.height },
          zIndex: topZIndex + index + 1,
          isCustomized: false,
        };
      });

      return newWindows;
    });
  }, [tabs, containerSize, topZIndex, floatingLayout]);

  // Recalculate grid positions for non-customized windows when container resizes
  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;

    setWindows((prevWindows) => {
      const nonCustomizedCount = prevWindows.filter(w => !w.isCustomized).length;
      if (nonCustomizedCount === 0) return prevWindows;

      const { cols, cellWidth, cellHeight } = calculateGridLayout(
        prevWindows.length,
        containerSize.width,
        containerSize.height
      );

      let gridIndex = 0;
      return prevWindows.map((window) => {
        if (window.isCustomized) {
          return window;
        }
        const gridPos = getGridPosition(gridIndex++, cols, cellWidth, cellHeight);
        return {
          ...window,
          position: { x: gridPos.x, y: gridPos.y },
          size: { width: gridPos.width, height: gridPos.height },
        };
      });
    });
  }, [containerSize]);

  // Save floating layout to context (which will save to server)
  const saveFloatingLayout = useCallback(() => {
    const positions: FloatingWindowPosition[] = windows.map(w => ({
      terminalId: w.terminalId,
      x: w.position.x,
      y: w.position.y,
      width: w.size.width,
      height: w.size.height,
      zIndex: w.zIndex,
      isCustomized: w.isCustomized,
    }));

    updateFloatingLayout({
      mode: 'floating',
      windows: positions,
    });
  }, [windows, updateFloatingLayout]);

  // Debounced save when windows change
  useEffect(() => {
    if (windows.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveFloatingLayout();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [windows, saveFloatingLayout]);

  const handleFocus = useCallback((windowId: string) => {
    setWindows((prev) => {
      const windowIndex = prev.findIndex((w) => w.id === windowId);
      if (windowIndex === -1) return prev;

      const newZIndex = topZIndex + 1;
      setTopZIndex(newZIndex);

      return prev.map((w) =>
        w.id === windowId ? { ...w, zIndex: newZIndex } : w
      );
    });
  }, [topZIndex]);

  const handleClose = useCallback((windowId: string) => {
    closeTab(windowId);
  }, [closeTab]);

  const handlePositionChange = useCallback(
    (windowId: string, position: { x: number; y: number }) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, position, isCustomized: true } : w
        )
      );
    },
    []
  );

  const handleSizeChange = useCallback(
    (windowId: string, size: { width: number; height: number }) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, size, isCustomized: true } : w
        )
      );
    },
    []
  );

  const resetToGrid = useCallback(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const { cols, cellWidth, cellHeight } = calculateGridLayout(
      windows.length,
      containerSize.width,
      containerSize.height
    );

    setWindows((prev) =>
      prev.map((window, index) => {
        const gridPos = getGridPosition(index, cols, cellWidth, cellHeight);
        return {
          ...window,
          position: { x: gridPos.x, y: gridPos.y },
          size: { width: gridPos.width, height: gridPos.height },
          isCustomized: false,
        };
      })
    );
  }, [windows.length, containerSize]);

  // Get terminal tabs to check if we actually have terminals
  const terminalTabs = tabs.filter((tab): tab is Tab & { terminalId: string } =>
    tab.type === 'terminal' && !!tab.terminalId
  );

  // Show loading state while container is being measured
  if (containerSize.width === 0 || containerSize.height === 0) {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background/50">
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  // Only show empty state when container is measured AND no terminals exist
  if (terminalTabs.length === 0) {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background/50 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No terminals open</p>
          <p className="text-sm">Create a new terminal to get started</p>
        </div>
      </div>
    );
  }

  const hasCustomizedWindows = windows.some(w => w.isCustomized);

  // Calculate the minimum content height based on window positions
  // This allows the container to grow as windows are moved down
  const calculateContentHeight = () => {
    if (windows.length === 0) return containerSize.height;

    const lowestEdge = Math.max(
      ...windows.map(w => w.position.y + w.size.height)
    );

    // Add padding at the bottom for comfortable scrolling
    const BOTTOM_PADDING = 100;
    return Math.max(containerSize.height, lowestEdge + BOTTOM_PADDING);
  };

  const contentHeight = calculateContentHeight();

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto bg-background/50"
    >
      {/* Inner container with dynamic height */}
      <div
        className="relative w-full"
        style={{ minHeight: contentHeight }}
      >
        {hasCustomizedWindows && (
          <button
            onClick={resetToGrid}
            className="sticky top-2 left-[calc(100%-120px)] z-[9999] px-3 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border"
            title="Reset to automatic grid layout"
          >
            Reset Layout
          </button>
        )}

        {windows.map((window) => (
          <FloatingTerminal
            key={window.id}
            id={window.id}
            terminalId={window.terminalId}
            token={token}
            name={window.name}
            initialPosition={window.position}
            initialSize={window.size}
            zIndex={window.zIndex}
            onFocus={() => handleFocus(window.id)}
            onClose={() => handleClose(window.id)}
            onPositionChange={(pos) => handlePositionChange(window.id, pos)}
            onSizeChange={(size) => handleSizeChange(window.id, size)}
          />
        ))}
      </div>
    </div>
  );
}
