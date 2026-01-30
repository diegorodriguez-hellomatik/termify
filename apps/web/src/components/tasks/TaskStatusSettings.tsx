'use client';

import { useState, useEffect } from 'react';
import { X, Plus, GripVertical, Trash2, Pencil, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskStatusConfig } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRESET_COLORS = [
  '#6B7280', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
];

interface TaskStatusSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusesChange?: () => void;
}

interface SortableStatusItemProps {
  status: TaskStatusConfig;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editName: string;
  editColor: string;
  onEditNameChange: (name: string) => void;
  onEditColorChange: (color: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

function SortableStatusItem({
  status,
  onEdit,
  onDelete,
  isEditing,
  editName,
  editColor,
  onEditNameChange,
  onEditColorChange,
  onSaveEdit,
  onCancelEdit,
}: SortableStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 bg-muted rounded-md",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
            autoFocus
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-5 h-5 rounded-full border-2",
                  editColor === color ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                onClick={() => onEditColorChange(color)}
              />
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={onSaveEdit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: status.color }}
          />
          <span className="flex-1 text-sm">{status.name}</span>
          <button
            className="p-1 hover:bg-accent rounded"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          {!status.isDefault && (
            <button
              className="p-1 hover:bg-accent rounded"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function TaskStatusSettings({
  open,
  onOpenChange,
  onStatusesChange,
}: TaskStatusSettingsProps) {
  const {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  } = useTaskStatuses();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(statuses, oldIndex, newIndex);
    await reorderStatuses(newOrder.map((s) => s.id));
    onStatusesChange?.();
  };

  const handleEdit = (status: TaskStatusConfig) => {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateStatus(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
    onStatusesChange?.();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const key = newName.toLowerCase().replace(/\s+/g, '_');
    await createStatus({
      key,
      name: newName.trim(),
      color: newColor,
      position: statuses.length,
    });
    setIsCreating(false);
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    onStatusesChange?.();
  };

  const handleDelete = async (id: string) => {
    await deleteStatus(id);
    onStatusesChange?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Task Status Settings</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={statuses.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {statuses.map((status) => (
                    <SortableStatusItem
                      key={status.id}
                      status={status}
                      onEdit={() => handleEdit(status)}
                      onDelete={() => handleDelete(status.id)}
                      isEditing={editingId === status.id}
                      editName={editName}
                      editColor={editColor}
                      onEditNameChange={setEditName}
                      onEditColorChange={setEditColor}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {isCreating ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Status name"
                  className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
                  autoFocus
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.slice(0, 5).map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-5 h-5 rounded-full border-2",
                        newColor === color ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewColor(color)}
                    />
                  ))}
                </div>
                <Button size="sm" onClick={handleCreate}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Status
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
