'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Task, TaskStatus, TaskPriority, TeamMember, TaskStatusConfig } from '@/lib/api';
import { TaskCard } from './TaskCard';
import { TaskColumn } from './TaskColumn';
import { TaskCreateModal } from './TaskCreateModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TeamTaskStatusSettings } from './TeamTaskStatusSettings';

interface TaskBoardProps {
  tasksByStatus: Record<TaskStatus, Task[]>;
  statuses: TaskStatusConfig[];
  teamId: string;
  teamMembers: TeamMember[];
  canManageStatuses: boolean;
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
  onStatusesChange?: () => void;
}

export function TaskBoard({
  tasksByStatus,
  statuses,
  teamId,
  teamMembers,
  canManageStatuses,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onAssignTask,
  onUnassignTask,
  onReorderTasks,
  onStatusesChange,
}: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>('todo');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

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
    const targetCol = columns.find((col) => col.status === overId);
    if (targetCol) {
      // Moving to a different column
      if (task.status !== targetCol.status) {
        await onUpdateTask(task.id, { status: targetCol.status });
        // Reorder the target column with the new task at the end
        const targetTasks = tasksByStatus[targetCol.status] || [];
        const newOrder = [...targetTasks.map((t) => t.id), task.id];
        await onReorderTasks(newOrder, targetCol.status);
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

  // Get default status for new tasks
  const defaultStatus = statuses.find((s) => s.isDefault)?.key || statuses[0]?.key || 'todo';

  return (
    <div className="flex flex-col h-full min-h-[300px]" onContextMenu={handleContextMenu}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <div className="flex items-center gap-2">
          {canManageStatuses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Customize Columns
            </Button>
          )}
          <Button onClick={() => handleOpenCreateModal(defaultStatus)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {columns.map((column) => (
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

      <TeamTaskStatusSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        teamId={teamId}
        onStatusesChange={onStatusesChange}
      />

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[9999] min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-popover overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
          >
            <button
              onClick={() => { handleOpenCreateModal(defaultStatus); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Plus size={16} className="text-primary" />
              <span>New Task</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
