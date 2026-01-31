'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskStatus } from '@/lib/api';
import { TaskCard } from './TaskCard';

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  color: string; // Now supports hex colors like "#6b7280" or Tailwind classes like "bg-gray-500"
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
}

// Helper to check if color is a hex color
function isHexColor(color: string): boolean {
  return color.startsWith('#');
}

export function TaskColumn({
  status,
  title,
  color,
  tasks,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  onDuplicateTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const colorStyle = isHexColor(color) ? { backgroundColor: color } : undefined;
  const colorClass = isHexColor(color) ? '' : color;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[200px] flex-1 bg-muted/30 rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
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
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onDelete={onDeleteTask}
              onDuplicate={onDuplicateTask}
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
