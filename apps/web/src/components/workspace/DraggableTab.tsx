'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { X, Terminal, GripVertical } from 'lucide-react';
import { Tab } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

interface DraggableTabProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  isDark: boolean;
}

export function DraggableTab({ tab, isActive, onActivate, onClose, isDark }: DraggableTabProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tab-${tab.id}`,
    data: {
      type: 'tab',
      tab,
      terminalId: tab.terminalId,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isActive ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 pl-2 pr-1 py-1.5 rounded-t-lg border-b-2 transition-all min-w-[100px] max-w-[180px]',
        isActive
          ? 'bg-background border-primary'
          : 'bg-muted/50 border-transparent hover:bg-muted',
        isDragging && 'shadow-lg cursor-grabbing'
      )}
      onClick={onActivate}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 transition-colors"
      >
        <GripVertical size={12} className="text-muted-foreground" />
      </div>

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
