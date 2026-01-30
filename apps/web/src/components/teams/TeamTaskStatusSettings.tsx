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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, X, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { TaskStatusConfig } from '@/lib/api';

interface TeamTaskStatusSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onStatusesChange?: () => void;
}

// Preset colors for quick selection
const PRESET_COLORS = [
  '#6b7280', // gray
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
];

interface SortableStatusItemProps {
  status: TaskStatusConfig;
  onUpdate: (id: string, data: { name?: string; color?: string; isDefault?: boolean }) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function SortableStatusItem({ status, onUpdate, onDelete, canDelete }: SortableStatusItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status.name);
  const [showColorPicker, setShowColorPicker] = useState(false);

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

  const handleSaveName = () => {
    if (editName.trim() && editName !== status.name) {
      onUpdate(status.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleColorChange = (color: string) => {
    onUpdate(status.id, { color });
    setShowColorPicker(false);
  };

  const handleSetDefault = () => {
    if (!status.isDefault) {
      onUpdate(status.id, { isDefault: true });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-card border rounded-lg',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-6 h-6 rounded-full border-2 border-border hover:border-primary transition-colors"
          style={{ backgroundColor: status.color }}
        />
        {showColorPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowColorPicker(false)}
            />
            <div className="absolute top-8 left-0 z-50 p-2 bg-popover border rounded-lg shadow-lg grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-all',
                    status.color === color
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-border'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Name */}
      <div className="flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditName(status.name);
                  setIsEditing(false);
                }
              }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditName(status.name);
                setIsEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium hover:underline"
          >
            {status.name}
          </button>
        )}
        <p className="text-xs text-muted-foreground">Key: {status.key}</p>
      </div>

      {/* Default indicator / Set as default */}
      {status.isDefault ? (
        <span className="text-xs text-primary flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Default
        </span>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={handleSetDefault}
        >
          Set Default
        </Button>
      )}

      {/* Delete button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(status.id)}
        disabled={!canDelete || status.isDefault}
        title={status.isDefault ? 'Cannot delete default status' : 'Delete status'}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TeamTaskStatusSettings({
  open,
  onOpenChange,
  teamId,
  onStatusesChange,
}: TeamTaskStatusSettingsProps) {
  const {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  } = useTaskStatuses({ teamId });

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6b7280');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; moveToId?: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!open) return null;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(statuses, oldIndex, newIndex);
      await reorderStatuses(newOrder.map((s) => s.id));
      onStatusesChange?.();
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatusName.trim() || !newStatusKey.trim()) return;

    const result = await createStatus({
      key: newStatusKey.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: newStatusName.trim(),
      color: newStatusColor,
    });

    if (result) {
      setNewStatusName('');
      setNewStatusKey('');
      setNewStatusColor('#6b7280');
      setShowAddForm(false);
      onStatusesChange?.();
    }
  };

  const handleUpdateStatus = async (
    id: string,
    data: { name?: string; color?: string; isDefault?: boolean }
  ) => {
    await updateStatus(id, data);
    onStatusesChange?.();
  };

  const handleDeleteStatus = async (id: string, moveToId?: string) => {
    await deleteStatus(id, moveToId);
    setDeleteConfirm(null);
    onStatusesChange?.();
  };

  const handleDeleteClick = async (statusId: string) => {
    // Check if there might be tasks with this status
    // For simplicity, we'll always show the migration dialog
    const otherStatuses = statuses.filter((s) => s.id !== statusId && !s.isDefault);
    if (otherStatuses.length > 0) {
      setDeleteConfirm({ id: statusId });
    } else {
      await handleDeleteStatus(statusId);
    }
  };

  const canDeleteStatuses = statuses.length > 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Customize Task Statuses</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-8rem)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag to reorder. Click on a name to edit it. The default status is used for new tasks.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={statuses.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {statuses.map((status) => (
                        <SortableStatusItem
                          key={status.id}
                          status={status}
                          onUpdate={handleUpdateStatus}
                          onDelete={handleDeleteClick}
                          canDelete={canDeleteStatuses}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add new status */}
                {showAddForm ? (
                  <div className="mt-4 p-3 border rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          className="w-6 h-6 rounded-full border-2 border-border"
                          style={{ backgroundColor: newStatusColor }}
                          onClick={() => {
                            const colors = PRESET_COLORS;
                            const currentIndex = colors.indexOf(newStatusColor);
                            setNewStatusColor(colors[(currentIndex + 1) % colors.length]);
                          }}
                        />
                      </div>
                      <Input
                        placeholder="Status name"
                        value={newStatusName}
                        onChange={(e) => {
                          setNewStatusName(e.target.value);
                          // Auto-generate key from name
                          setNewStatusKey(
                            e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '_')
                              .replace(/[^a-z0-9_]/g, '')
                          );
                        }}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Key:</span>
                      <Input
                        placeholder="status_key"
                        value={newStatusKey}
                        onChange={(e) =>
                          setNewStatusKey(
                            e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '_')
                              .replace(/[^a-z0-9_]/g, '')
                          )
                        }
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateStatus}
                        disabled={!newStatusName.trim() || !newStatusKey.trim()}
                      >
                        Add Status
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewStatusName('');
                          setNewStatusKey('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full mt-4 gap-2"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Status
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-background border rounded-lg shadow-xl w-full max-w-sm p-4 pointer-events-auto">
              <h3 className="font-semibold mb-2">Delete Status</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tasks with this status will be moved to:
              </p>
              <div className="space-y-2 mb-4">
                {statuses
                  .filter((s) => s.id !== deleteConfirm.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setDeleteConfirm({ ...deleteConfirm, moveToId: s.id })
                      }
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded border text-left',
                        deleteConfirm.moveToId === s.id
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm">{s.name}</span>
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    handleDeleteStatus(deleteConfirm.id, deleteConfirm.moveToId)
                  }
                  disabled={!deleteConfirm.moveToId}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
