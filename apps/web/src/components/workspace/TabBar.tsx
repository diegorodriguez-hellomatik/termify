'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Plus, Terminal, ChevronDown } from 'lucide-react';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  isDark: boolean;
}

function SortableTab({ tab, isActive, onActivate, onClose, isDark }: TabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isActive ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer transition-all min-w-[120px] max-w-[200px]',
        isActive
          ? 'bg-background border-primary'
          : 'bg-muted/50 border-transparent hover:bg-muted',
        isDragging && 'shadow-lg'
      )}
      onClick={onActivate}
      {...attributes}
      {...listeners}
    >
      <Terminal size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium truncate flex-1">{tab.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          'p-0.5 rounded hover:bg-destructive/20 transition-colors flex-shrink-0',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <X size={12} className="text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

interface TabBarProps {
  onAddTab: () => void;
  isDark: boolean;
}

export function TabBar({ onAddTab, isDark }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useWorkspace();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderTabs(oldIndex, newIndex);
    }
  };

  if (tabs.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1 border-b border-border"
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
      >
        <button
          onClick={onAddTab}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Plus size={14} />
          Open Terminal
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 border-b border-border overflow-x-auto"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                isDark={isDark}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add new tab button */}
      <button
        onClick={onAddTab}
        className="p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0"
        title="Open new terminal"
      >
        <Plus size={16} className="text-muted-foreground" />
      </button>
    </div>
  );
}
