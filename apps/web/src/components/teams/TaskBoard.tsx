'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Task, TaskStatus, TaskPriority, TeamMember } from '@/lib/api';
import { TaskCard } from './TaskCard';
import { TaskColumn } from './TaskColumn';
import { TaskCreateModal } from './TaskCreateModal';
import { TaskDetailModal } from './TaskDetailModal';

interface TaskBoardProps {
  tasksByStatus: Record<TaskStatus, Task[]>;
  teamMembers: TeamMember[];
  onCreateTask: (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
  }) => Promise<Task | null>;
  onUpdateTask: (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
  }) => Promise<Task | null>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onAssignTask: (taskId: string, teamMemberId: string) => Promise<any>;
  onUnassignTask: (taskId: string, assigneeId: string) => Promise<boolean>;
  onReorderTasks: (taskIds: string[], status: TaskStatus) => Promise<boolean>;
}

const COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'BACKLOG', title: 'Backlog', color: 'bg-gray-500' },
  { status: 'TODO', title: 'To Do', color: 'bg-blue-500' },
  { status: 'IN_PROGRESS', title: 'In Progress', color: 'bg-yellow-500' },
  { status: 'IN_REVIEW', title: 'In Review', color: 'bg-purple-500' },
  { status: 'DONE', title: 'Done', color: 'bg-green-500' },
];

export function TaskBoard({
  tasksByStatus,
  teamMembers,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onAssignTask,
  onUnassignTask,
  onReorderTasks,
}: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>('TODO');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the task being dragged
    const task = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === activeId);

    if (!task) return;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find((col) => col.status === overId);
    if (targetColumn) {
      // Moving to a different column
      if (task.status !== targetColumn.status) {
        await onUpdateTask(task.id, { status: targetColumn.status });
        // Reorder the target column with the new task at the end
        const targetTasks = tasksByStatus[targetColumn.status];
        const newOrder = [...targetTasks.map((t) => t.id), task.id];
        await onReorderTasks(newOrder, targetColumn.status);
      }
      return;
    }

    // Check if dropped on another task
    const targetTask = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === overId);

    if (targetTask) {
      const sourceColumn = task.status;
      const targetColumn = targetTask.status;

      if (sourceColumn === targetColumn) {
        // Reordering within the same column
        const columnTasks = [...tasksByStatus[sourceColumn]];
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);

        if (oldIndex !== newIndex) {
          columnTasks.splice(oldIndex, 1);
          columnTasks.splice(newIndex, 0, task);
          await onReorderTasks(columnTasks.map((t) => t.id), sourceColumn);
        }
      } else {
        // Moving to a different column
        await onUpdateTask(task.id, { status: targetColumn });
        // Insert at the position of the target task
        const targetTasks = [...tasksByStatus[targetColumn]];
        const targetIndex = targetTasks.findIndex((t) => t.id === overId);
        targetTasks.splice(targetIndex, 0, task);
        await onReorderTasks(targetTasks.map((t) => t.id), targetColumn);
      }
    }
  };

  const handleOpenCreateModal = (status: TaskStatus) => {
    setCreateModalStatus(status);
    setCreateModalOpen(true);
  };

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
  }) => {
    return onCreateTask({
      ...data,
      status: createModalStatus,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <Button onClick={() => handleOpenCreateModal('TODO')}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((column) => (
            <TaskColumn
              key={column.status}
              status={column.status}
              title={column.title}
              color={column.color}
              tasks={tasksByStatus[column.status] || []}
              onAddTask={() => handleOpenCreateModal(column.status)}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isOverlay />}
        </DragOverlay>
      </DndContext>

      <TaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
        teamMembers={teamMembers}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          teamMembers={teamMembers}
          onClose={() => setSelectedTask(null)}
          onUpdate={onUpdateTask}
          onDelete={onDeleteTask}
          onAssign={onAssignTask}
          onUnassign={onUnassignTask}
        />
      )}
    </div>
  );
}
