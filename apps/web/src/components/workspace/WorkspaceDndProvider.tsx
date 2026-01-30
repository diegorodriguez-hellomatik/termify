'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Terminal } from 'lucide-react';
import { DropPosition } from './DropZoneOverlay';

interface DropPositionState {
  paneId: string;
  position: DropPosition;
}

interface DraggedTab {
  id: string;
  terminalId: string;
  name: string;
}

interface WorkspaceDndContextType {
  dropPositionRef: React.MutableRefObject<DropPositionState | null>;
  setDropPosition: (paneId: string, position: DropPosition) => void;
  isDraggingTab: boolean;
  draggedTab: DraggedTab | null;
  activeDroppableId: string | null;
}

const WorkspaceDndContextInternal = createContext<WorkspaceDndContextType | null>(null);

export function useWorkspaceDnd() {
  const context = useContext(WorkspaceDndContextInternal);
  if (!context) {
    throw new Error('useWorkspaceDnd must be used within WorkspaceDndProvider');
  }
  return context;
}

interface WorkspaceDndProviderProps {
  children: ReactNode;
  onTabDrop: (paneId: string, terminalId: string, position: DropPosition) => void;
  onTabReorder: (oldIndex: number, newIndex: number) => void;
  tabIds: string[];
}


export function WorkspaceDndProvider({
  children,
  onTabDrop,
  onTabReorder,
  tabIds,
}: WorkspaceDndProviderProps) {
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [draggedTab, setDraggedTab] = useState<DraggedTab | null>(null);
  const [activeDroppableId, setActiveDroppableId] = useState<string | null>(null);
  const dropPositionRef = useRef<DropPositionState | null>(null);

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

  const setDropPosition = useCallback((paneId: string, position: DropPosition) => {
    if (position) {
      dropPositionRef.current = { paneId, position };
    } else {
      if (dropPositionRef.current?.paneId === paneId) {
        dropPositionRef.current = null;
      }
    }
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === 'tab') {
      setIsDraggingTab(true);
      setDraggedTab({
        id: String(active.id),
        terminalId: data.terminalId,
        name: data.name || 'Terminal',
      });
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    if (over) {
      const overId = String(over.id);
      if (overId.startsWith('pane-')) {
        setActiveDroppableId(overId);
      } else {
        setActiveDroppableId(null);
      }
    } else {
      setActiveDroppableId(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setIsDraggingTab(false);
    setDraggedTab(null);
    setActiveDroppableId(null);

    if (!over) {
      dropPositionRef.current = null;
      return;
    }

    const activeData = active.data.current;
    const overId = String(over.id);

    // Check if dropped on a pane (for split)
    if (overId.startsWith('pane-') && activeData?.type === 'tab') {
      const dropPos = dropPositionRef.current;
      const terminalId = activeData.terminalId;

      if (dropPos && terminalId && dropPos.position) {
        onTabDrop(dropPos.paneId, terminalId, dropPos.position);
      }

      dropPositionRef.current = null;
      return;
    }

    // Handle tab reordering (dropped on another tab)
    if (activeData?.type === 'tab' && !overId.startsWith('pane-')) {
      const activeId = String(active.id);
      const oldIndex = tabIds.indexOf(activeId);
      const newIndex = tabIds.indexOf(overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onTabReorder(oldIndex, newIndex);
      }
    }

    dropPositionRef.current = null;
  }, [tabIds, onTabReorder, onTabDrop]);

  const handleDragCancel = useCallback(() => {
    setIsDraggingTab(false);
    setDraggedTab(null);
    setActiveDroppableId(null);
    dropPositionRef.current = null;
  }, []);

  return (
    <WorkspaceDndContextInternal.Provider
      value={{
        dropPositionRef,
        setDropPosition,
        isDraggingTab,
        draggedTab,
        activeDroppableId,
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* Drag overlay - shows the tab being dragged */}
        <DragOverlay dropAnimation={null}>
          {draggedTab && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground shadow-lg border border-primary/50">
              <Terminal size={14} />
              <span className="text-sm font-medium">{draggedTab.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </WorkspaceDndContextInternal.Provider>
  );
}
