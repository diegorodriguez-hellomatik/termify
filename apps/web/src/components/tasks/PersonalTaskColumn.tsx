'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonalTask, TaskStatus } from '@/lib/api';
import { PersonalTaskCard } from './PersonalTaskCard';

interface PersonalTaskColumnProps {
  id?: string; // ID for sortable (status config ID)
  status: TaskStatus;
  title: string;
  color: string; // Now supports hex colors like "#6b7280" or Tailwind classes like "bg-gray-500"
  tasks: PersonalTask[];
  onAddTask: () => void;
  onTaskClick: (task: PersonalTask) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskDuplicate?: (task: PersonalTask) => void;
}

// Helper to check if color is a hex color
function isHexColor(color: string): boolean {
  return color.startsWith('#');
}

export function PersonalTaskColumn({
  id,
  status,
  title,
  color,
  tasks,
  onAddTask,
  onTaskClick,
  onTaskDelete,
  onTaskDuplicate,
}: PersonalTaskColumnProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: status,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id || status,
    disabled: !id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colorStyle = isHexColor(color) ? { backgroundColor: color } : undefined;
  const colorClass = isHexColor(color) ? '' : color;

  return (
    <div
      ref={(node) => {
        setDroppableRef(node);
        setSortableRef(node);
      }}
      style={style}
      className={cn(
        'flex flex-col min-w-[200px] flex-1 bg-muted/30 rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset',
        isDragging && 'opacity-50'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {id && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground -ml-1"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div
            className={cn('w-2 h-2 rounded-full', colorClass)}
            style={colorStyle}
          />
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <PersonalTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onDelete={onTaskDelete}
              onDuplicate={onTaskDuplicate}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-xs">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
