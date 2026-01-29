'use client';

import { useDroppable } from '@dnd-kit/core';
import { useRef, useState, useEffect } from 'react';
import { DropZoneOverlay, DropPosition, calculateDropPosition } from './DropZoneOverlay';

interface DroppablePaneProps {
  id: string;
  terminalId: string;
  children: React.ReactNode;
  isDark: boolean;
  onDropPositionChange?: (position: DropPosition) => void;
}

export function DroppablePane({
  id,
  terminalId,
  children,
  isDark,
  onDropPositionChange,
}: DroppablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  const { isOver, setNodeRef, active } = useDroppable({
    id: `pane-${id}`,
    data: {
      type: 'pane',
      paneId: id,
      terminalId,
    },
  });

  // Track mouse position for drop zone calculation
  useEffect(() => {
    if (!isOver || !containerRef.current) {
      setDropPosition(null);
      onDropPositionChange?.(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const position = calculateDropPosition(rect, e.clientX, e.clientY);
      setDropPosition(position);
      onDropPositionChange?.(position);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isOver, onDropPositionChange]);

  // Check if dragging a tab (not reordering within same context)
  const isDraggingTab = active?.data?.current?.type === 'tab';
  const showOverlay = isOver && isDraggingTab;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (containerRef as any).current = node;
      }}
      className="relative h-full w-full"
    >
      {children}
      <DropZoneOverlay
        isActive={showOverlay}
        position={dropPosition}
        isDark={isDark}
      />
    </div>
  );
}
