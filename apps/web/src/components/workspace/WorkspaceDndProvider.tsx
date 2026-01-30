'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DropPosition } from './DropZoneOverlay';

interface WorkspaceDndContextType {
  activeDragId: string | null;
  isDragging: boolean;
}

const WorkspaceDndContext = createContext<WorkspaceDndContextType>({
  activeDragId: null,
  isDragging: false,
});

export function useWorkspaceDnd() {
  return useContext(WorkspaceDndContext);
}

interface WorkspaceDndProviderProps {
  children: ReactNode;
  onTabDrop: (paneId: string, terminalId: string, position: DropPosition) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  tabIds: string[];
}

export function WorkspaceDndProvider({
  children,
  onTabDrop,
  onTabReorder,
  tabIds,
}: WorkspaceDndProviderProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = tabIds.indexOf(active.id as string);
    const newIndex = tabIds.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      onTabReorder(oldIndex, newIndex);
    }
  }, [tabIds, onTabReorder]);

  return (
    <WorkspaceDndContext.Provider value={{ activeDragId, isDragging: !!activeDragId }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    </WorkspaceDndContext.Provider>
  );
}
