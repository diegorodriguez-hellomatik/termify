'use client';

import { useDroppable } from '@dnd-kit/core';
import { useRef, useState, useEffect } from 'react';
import { DropZoneOverlay, DropPosition, calculateDropPosition } from './DropZoneOverlay';
import { useWorkspaceDnd } from './WorkspaceDndProvider';

interface DroppablePaneProps {
  id: string;
  terminalId: string;
  children: React.ReactNode;
  isDark: boolean;
}

export function DroppablePane({
  id,
  terminalId,
  children,
  isDark,
}: DroppablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  // Get context from WorkspaceDndProvider
  const { isDraggingTab, setDropPosition: updateDropPosition } = useWorkspaceDnd();

  const droppableId = `pane-${id}`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type: 'pane',
      paneId: id,
      terminalId,
    },
  });

  // Use isOver from the hook - this is the most reliable signal
  // that the draggable is currently over this droppable
  const isActiveTarget = isOver && isDraggingTab;

  // Track mouse position for drop zone calculation when dragging over this pane
  useEffect(() => {
    if (!isActiveTarget || !containerRef.current) {
      setDropPosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const position = calculateDropPosition(rect, e.clientX, e.clientY);
      setDropPosition(position);
      updateDropPosition(id, position);
    };

    // Set up continuous tracking while over this pane
    window.addEventListener('mousemove', handleMouseMove);

    // Trigger initial position calculation
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
    });
    handleMouseMove(mouseEvent as MouseEvent);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      updateDropPosition(id, null);
    };
  }, [isActiveTarget, id, updateDropPosition]);

  // Show overlay when dragging a tab and hovering over this pane
  const showOverlay = isActiveTarget;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (containerRef as any).current = node;
      }}
      className="relative h-full w-full"
    >
      {children}
      {/* Invisible overlay to capture pointer events during drag */}
      {isDraggingTab && (
        <div
          className="absolute inset-0 z-40"
          style={{ backgroundColor: 'transparent' }}
        />
      )}
      <DropZoneOverlay
        isActive={showOverlay}
        position={dropPosition}
        isDark={isDark}
      />
    </div>
  );
}
