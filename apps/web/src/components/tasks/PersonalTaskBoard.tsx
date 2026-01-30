'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  pointerWithin,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { PersonalTask, TaskStatus, TaskPriority, TaskStatusConfig, Workspace } from '@/lib/api';
import { PersonalTaskCard } from './PersonalTaskCard';
import { PersonalTaskColumn } from './PersonalTaskColumn';
import { PersonalTaskCreateModal } from './PersonalTaskCreateModal';
import { PersonalTaskDetailModal } from './PersonalTaskDetailModal';
import { TaskStatusSettings } from './TaskStatusSettings';

interface PersonalTaskBoardProps {
  tasksByStatus: Record<TaskStatus, PersonalTask[]>;
  statuses: TaskStatusConfig[];
  workspaces?: Workspace[];
  onCreateTask: (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
  }) => Promise<PersonalTask | null>;
  onUpdateTask: (id: string, data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
    workspaceId?: string | null;
  }) => Promise<PersonalTask | null>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onReorderTasks: (taskIds: string[], status: TaskStatus) => Promise<boolean>;
  onReorderStatuses?: (statusIds: string[]) => Promise<boolean>;
  onStatusesChange?: () => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

export function PersonalTaskBoard({
  tasksByStatus,
  statuses,
  workspaces = [],
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onReorderStatuses,
  onStatusesChange,
  settingsOpen: externalSettingsOpen,
  onSettingsOpenChange,
}: PersonalTaskBoardProps) {
  const [activeTask, setActiveTask] = useState<PersonalTask | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>('todo');
  const [selectedTask, setSelectedTask] = useState<PersonalTask | null>(null);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const settingsOpen = externalSettingsOpen ?? internalSettingsOpen;
  const setSettingsOpen = onSettingsOpenChange ?? setInternalSettingsOpen;

  // Create columns from statuses
  const columns = useMemo(() => {
    return statuses.map((status) => ({
      status: status.key,
      title: status.name,
      color: status.color,
    }));
  }, [statuses]);

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

    // Check if dragging a column
    const isColumn = statuses.some((s) => s.id === active.id);
    if (isColumn) {
      setActiveColumnId(active.id as string);
      return;
    }

    // Otherwise dragging a task
    const task = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset drag states
    setActiveTask(null);
    setActiveColumnId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a column
    const isColumnDrag = statuses.some((s) => s.id === activeId);
    if (isColumnDrag) {
      if (activeId !== overId && onReorderStatuses) {
        const oldIndex = statuses.findIndex((s) => s.id === activeId);
        const newIndex = statuses.findIndex((s) => s.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(statuses, oldIndex, newIndex);
          await onReorderStatuses(newOrder.map((s) => s.id));
          onStatusesChange?.();
        }
      }
      return;
    }

    // Find the task being dragged
    const task = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === activeId);

    if (!task) return;

    // Check if dropped on a column
    const targetColumn = columns.find((col) => col.status === overId);
    if (targetColumn) {
      // Moving to a different column
      if (task.status !== targetColumn.status) {
        await onUpdateTask(task.id, { status: targetColumn.status });
        // Reorder the target column with the new task at the end
        const targetTasks = tasksByStatus[targetColumn.status] || [];
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
    dueDate?: string | null;
  }) => {
    return onCreateTask({
      ...data,
      status: createModalStatus,
    });
  };

  const handleDuplicateTask = async (task: PersonalTask) => {
    // Copy all task properties including workspaceId to keep it in the same workspace
    await onCreateTask({
      title: `${task.title} (copy)`,
      description: task.description || undefined,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate || undefined,
      workspaceId: task.workspaceId,
    });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <SortableContext
          items={statuses.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
            {columns.map((column) => {
              const status = statuses.find((s) => s.key === column.status);
              return (
                <PersonalTaskColumn
                  key={column.status}
                  id={status?.id}
                  status={column.status}
                  title={column.title}
                  color={column.color}
                  tasks={tasksByStatus[column.status] || []}
                  onAddTask={() => handleOpenCreateModal(column.status)}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={onDeleteTask}
                  onTaskDuplicate={handleDuplicateTask}
                />
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
          {activeTask && <PersonalTaskCard task={activeTask} isOverlay />}
          {activeColumnId && (
            <div className="w-72 h-32 bg-card/80 border border-primary rounded-lg flex items-center justify-center shadow-xl">
              <span className="text-sm font-medium">
                {statuses.find((s) => s.id === activeColumnId)?.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <PersonalTaskCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateTask}
      />

      {selectedTask && (
        <PersonalTaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={onUpdateTask}
          onDelete={onDeleteTask}
          workspaces={workspaces}
        />
      )}

      <TaskStatusSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onStatusesChange={onStatusesChange}
      />
    </>
  );
}
