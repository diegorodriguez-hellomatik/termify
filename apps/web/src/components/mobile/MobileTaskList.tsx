'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RefreshCw, ChevronDown, ChevronRight, MoreVertical, Plus, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { TaskPriority, PersonalTask, TaskStatusConfig, Workspace } from '@/lib/api';

interface MobileTaskListProps {
  tasksByStatus: Record<string, PersonalTask[]>;
  statuses: TaskStatusConfig[];
  workspaces?: Workspace[];
  selectedWorkspaceId?: string | null;
  onSelectWorkspace?: (workspaceId: string | null) => void;
  onTaskClick?: (task: PersonalTask) => void;
  onCreateTask?: () => void;
  onCreateTaskInStatus?: (statusId: string) => void;
  onRefresh?: () => Promise<void>;
  onUpdateTaskStatus?: (taskId: string, newStatus: string) => Promise<void>;
  isLoading?: boolean;
}

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bgColor: string; label: string }> = {
  URGENT: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Urgent' },
  HIGH: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'High' },
  MEDIUM: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Medium' },
  LOW: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Low' },
};

// Draggable Task Card
function DraggableTaskCard({
  task,
  statuses,
  currentStatusKey,
  onClick,
  onMoveToStatus,
  isDragOverlay = false,
}: {
  task: PersonalTask;
  statuses: TaskStatusConfig[];
  currentStatusKey: string;
  onClick?: () => void;
  onMoveToStatus?: (statusKey: string) => void;
  isDragOverlay?: boolean;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
      statusKey: currentStatusKey,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isDragOverlay) {
    return (
      <div
        className={cn(
          'bg-card border-2 border-primary rounded-lg p-3 shadow-xl',
          'touch-manipulation rotate-2 scale-105'
        )}
      >
        <p className={cn(
          'font-medium text-sm text-foreground line-clamp-2',
          task.status === 'done' && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            priorityConfig.bgColor,
            priorityConfig.color
          )}>
            {priorityConfig.label}
          </span>
        </div>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not dragging
    if (!isDragging && onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'relative touch-manipulation cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 z-50'
      )}
    >
      <div
        className={cn(
          'bg-card border border-border rounded-lg p-3',
          'transition-all',
          isDragging && 'border-primary shadow-lg'
        )}
      >
        <div className="flex items-start gap-2">
          <p
            className={cn(
              'font-medium text-sm text-foreground line-clamp-2 flex-1',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </p>
          {onMoveToStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowMoveMenu(!showMoveMenu);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 -mr-1 -mt-1 rounded hover:bg-muted text-muted-foreground"
            >
              <MoreVertical size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            priorityConfig.bgColor,
            priorityConfig.color
          )}>
            {priorityConfig.label}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Move menu */}
      {showMoveMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMoveMenu(false)}
          />
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
              Move to
            </div>
            {statuses.map((status) => (
              <button
                key={status.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(false);
                  if (status.key !== currentStatusKey) {
                    onMoveToStatus?.(status.key);
                  }
                }}
                disabled={status.key === currentStatusKey}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  'hover:bg-muted transition-colors',
                  status.key === currentStatusKey && 'opacity-50 cursor-not-allowed bg-muted/50'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <span>{status.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Droppable Status Section
function DroppableStatusSection({
  status,
  tasks,
  statuses,
  isExpanded,
  onToggle,
  onTaskClick,
  onMoveTask,
  onAddTask,
}: {
  status: TaskStatusConfig;
  tasks: PersonalTask[];
  statuses: TaskStatusConfig[];
  isExpanded: boolean;
  onToggle: () => void;
  onTaskClick?: (task: PersonalTask) => void;
  onMoveTask?: (taskId: string, newStatusKey: string) => void;
  onAddTask?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${status.key}`,
    data: {
      type: 'status',
      statusKey: status.key,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        isOver
          ? 'border-primary border-2 bg-primary/5'
          : 'border-border'
      )}
      data-status-key={status.key}
    >
      {/* Section Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-3',
          'bg-muted/30 hover:bg-muted/50 transition-colors'
        )}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="font-medium text-sm flex-1 text-left">{status.name}</span>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
        {isExpanded ? (
          <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground" />
        )}
      </button>

      {/* Tasks */}
      {isExpanded && (
        <div className="p-2 space-y-2 bg-background min-h-[60px]">
          {tasks.length === 0 ? (
            <button
              onClick={onAddTask}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-2 py-6',
                'border-2 border-dashed rounded-lg transition-colors',
                isOver
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary'
              )}
            >
              <Plus size={20} />
              <span className="text-xs">{isOver ? 'Drop here' : 'Add task'}</span>
            </button>
          ) : (
            <SortableContext
              items={tasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <DraggableTaskCard
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  currentStatusKey={status.key}
                  onClick={() => onTaskClick?.(task)}
                  onMoveToStatus={onMoveTask ? (newStatusKey) => onMoveTask(task.id, newStatusKey) : undefined}
                />
              ))}
              {/* Add task button at bottom */}
              <button
                onClick={onAddTask}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2',
                  'border border-dashed border-border/50 rounded-lg',
                  'hover:border-primary/50 hover:bg-primary/5 transition-colors',
                  'text-xs text-muted-foreground hover:text-primary'
                )}
              >
                <Plus size={14} />
                <span>Add task</span>
              </button>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileTaskList({
  tasksByStatus,
  statuses,
  workspaces = [],
  selectedWorkspaceId,
  onSelectWorkspace,
  onTaskClick,
  onCreateTask,
  onCreateTaskInStatus,
  onRefresh,
  onUpdateTaskStatus,
  isLoading = false,
}: MobileTaskListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTask, setActiveTask] = useState<PersonalTask | null>(null);

  // Track which sections are expanded - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(statuses.map(s => s.id))
  );

  // Sensors for drag and drop - PointerSensor works on both touch and mouse
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required to start drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  const toggleSection = useCallback((statusId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  }, []);

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

    if (!over || !onUpdateTaskStatus) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the task being dragged
    const task = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === activeId);

    if (!task) return;

    // Check if dropped on a status section
    if (overId.startsWith('status-')) {
      const newStatusKey = overId.replace('status-', '');
      if (newStatusKey !== task.status) {
        await onUpdateTaskStatus(task.id, newStatusKey);
      }
      return;
    }

    // Check if dropped on another task
    const targetTask = Object.values(tasksByStatus)
      .flat()
      .find((t) => t.id === overId);

    if (targetTask && targetTask.status !== task.status) {
      await onUpdateTaskStatus(task.id, targetTask.status);
    }
  };

  // Get all tasks count
  const allTasks = Object.values(tasksByStatus).flat();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with refresh */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div>
          <h1 className="text-xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {allTasks.length} task{allTasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                'p-2 rounded-full',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'disabled:opacity-50 transition-all'
              )}
            >
              <RefreshCw
                size={18}
                className={cn((isRefreshing || isLoading) && 'animate-spin')}
              />
            </button>
          )}
          {onCreateTask && (
            <button
              onClick={onCreateTask}
              className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Workspace Tabs - Horizontal scrollable */}
      {onSelectWorkspace && (
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-border bg-background">
          {/* All Tasks Tab */}
          <button
            onClick={() => onSelectWorkspace(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
              selectedWorkspaceId === null
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            All
          </button>

          {/* Workspace Tabs */}
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                selectedWorkspaceId === workspace.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground'
              )}
              style={{
                backgroundColor:
                  selectedWorkspaceId === workspace.id
                    ? workspace.color || '#6366f1'
                    : undefined,
              }}
            >
              <Folder size={12} />
              {workspace.name}
            </button>
          ))}

          {/* Independent Tasks Tab */}
          <button
            onClick={() => onSelectWorkspace('independent')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
              selectedWorkspaceId === 'independent'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Independent
          </button>
        </div>
      )}

      {/* Board sections - vertical with drag and drop */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {statuses.map((status) => {
              // Use status.key to match tasksByStatus keys (e.g., "backlog", "todo")
              const tasks = tasksByStatus[status.key] || [];

              return (
                <DroppableStatusSection
                  key={status.id}
                  status={status}
                  tasks={tasks}
                  statuses={statuses}
                  isExpanded={expandedSections.has(status.id)}
                  onToggle={() => toggleSection(status.id)}
                  onTaskClick={onTaskClick}
                  onMoveTask={onUpdateTaskStatus}
                  onAddTask={() => {
                    if (onCreateTaskInStatus) {
                      onCreateTaskInStatus(status.key);
                    } else if (onCreateTask) {
                      onCreateTask();
                    }
                  }}
                />
              );
            })}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTask ? (
              <DraggableTaskCard
                task={activeTask}
                statuses={statuses}
                currentStatusKey={activeTask.status}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
