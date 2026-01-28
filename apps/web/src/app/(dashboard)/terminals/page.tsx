'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Terminal as TerminalIcon,
  Trash2,
  Play,
  GripVertical,
  Folder,
  FolderPlus,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { TerminalStatus } from '@claude-terminal/shared';
import { terminalsApi, categoriesApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

interface TerminalData {
  id: string;
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  createdAt: string;
  lastActiveAt: string | null;
  categoryId: string | null;
  position: number;
  category?: { id: string; name: string; color: string; icon?: string } | null;
}

interface CategoryData {
  id: string;
  name: string;
  color: string;
  icon?: string;
  position: number;
  terminalCount: number;
}

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'bg-gray-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500',
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
};

// Sortable Terminal Card Component
function SortableTerminalCard({
  terminal,
  onDelete,
  onRename,
  isDark,
}: {
  terminal: TerminalData;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  isDark: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(terminal.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: terminal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isDragging ? 'shadow-2xl scale-105' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 cursor-grab active:cursor-grabbing p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        <GripVertical size={16} className="text-muted-foreground" />
      </div>

      <div className="p-5 pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 ml-6">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: terminal.category?.color
                  ? `${terminal.category.color}20`
                  : isDark
                  ? '#333'
                  : '#f0f0f0',
              }}
            >
              <TerminalIcon
                size={20}
                style={{ color: terminal.category?.color || (isDark ? '#888' : '#666') }}
              />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 text-sm font-semibold rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary w-32"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRename(terminal.id, editName);
                        setIsEditing(false);
                      }
                      if (e.key === 'Escape') {
                        setEditName(terminal.name);
                        setIsEditing(false);
                      }
                    }}
                    onBlur={() => {
                      if (editName !== terminal.name) {
                        onRename(terminal.id, editName);
                      }
                      setIsEditing(false);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-foreground">{terminal.name}</h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                  >
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {terminal.cols}x{terminal.rows}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[terminal.status]}`} />
            <button
              onClick={() => onDelete(terminal.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-md transition-all"
            >
              <Trash2 size={14} className="text-destructive" />
            </button>
          </div>
        </div>

        {terminal.category && (
          <div
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-3"
            style={{
              backgroundColor: `${terminal.category.color}20`,
              color: terminal.category.color,
            }}
          >
            <Folder size={12} />
            {terminal.category.name}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>
            {terminal.lastActiveAt
              ? `Active ${formatRelativeTime(terminal.lastActiveAt)}`
              : `Created ${formatRelativeTime(terminal.createdAt)}`}
          </span>
          <span className="capitalize">{terminal.status.toLowerCase()}</span>
        </div>

        <Link href={`/terminals/${terminal.id}`}>
          <button className="w-full py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 font-medium text-sm">
            {terminal.status === TerminalStatus.RUNNING ? (
              <>
                <Play size={14} />
                Connect
              </>
            ) : (
              <>
                <TerminalIcon size={14} />
                Open
              </>
            )}
          </button>
        </Link>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  terminal,
  onConfirm,
  onCancel,
  isDark,
}: {
  terminal: TerminalData;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText === terminal.name;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl scale-in overflow-hidden"
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <h3
                className="text-lg font-semibold"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                Delete Terminal
              </h3>
              <p
                className="text-sm"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                This action cannot be undone
              </p>
            </div>
          </div>

          {/* Content */}
          <p
            className="text-sm mb-4"
            style={{ color: isDark ? '#ccc' : '#444' }}
          >
            To confirm deletion, type <strong>{terminal.name}</strong> below:
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type terminal name to confirm"
            className="w-full px-4 py-3 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
            style={{
              backgroundColor: isDark ? '#0a0a0a' : '#f9f9f9',
              borderColor: isDark ? '#333' : '#e0e0e0',
              color: isDark ? '#fff' : '#1a1a1a',
            }}
            autoFocus
          />

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              style={{
                backgroundColor: isDark ? '#333' : '#f0f0f0',
                color: isDark ? '#fff' : '#1a1a1a',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canDelete}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canDelete ? '#ef4444' : isDark ? '#333' : '#ccc',
                color: '#fff',
              }}
            >
              Delete Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TerminalsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isDark } = useTheme();
  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [terminalToDelete, setTerminalToDelete] = useState<TerminalData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const [terminalsRes, categoriesRes] = await Promise.all([
        terminalsApi.list(session.accessToken),
        categoriesApi.list(session.accessToken),
      ]);

      if (terminalsRes.success && terminalsRes.data) {
        setTerminals(terminalsRes.data.terminals);
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data.categories);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTerminal = async () => {
    if (!session?.accessToken) return;

    setCreating(true);
    try {
      const response = await terminalsApi.create(
        {
          name: `Terminal ${terminals.length + 1}`,
          categoryId: selectedCategory || undefined,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        // Add with animation class
        const newTerminal = { ...response.data, isNew: true };
        setTerminals([newTerminal, ...terminals]);

        // Navigate to the new terminal after animation
        setTimeout(() => {
          router.push(`/terminals/${response.data.id}`);
        }, 500);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTerminal = (id: string) => {
    const terminal = terminals.find((t) => t.id === id);
    if (terminal) {
      setTerminalToDelete(terminal);
    }
  };

  const confirmDeleteTerminal = async () => {
    if (!session?.accessToken || !terminalToDelete) return;

    const idToDelete = terminalToDelete.id;

    try {
      const response = await terminalsApi.delete(idToDelete, session.accessToken);
      if (response.success) {
        // Use functional update to ensure we have the latest state
        setTerminals((prev) => prev.filter((t) => t.id !== idToDelete));
      }
    } catch (error) {
      console.error('Failed to delete terminal:', error);
    } finally {
      setTerminalToDelete(null);
    }
  };

  const handleRenameTerminal = async (id: string, newName: string) => {
    if (!session?.accessToken || !newName.trim()) return;

    try {
      const response = await terminalsApi.update(id, { name: newName.trim() }, session.accessToken);
      if (response.success) {
        setTerminals(terminals.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t)));
      }
    } catch (error) {
      console.error('Failed to rename terminal:', error);
    }
  };

  const handleCreateCategory = async () => {
    if (!session?.accessToken || !newCategoryName.trim()) return;

    setCreatingCategory(true);
    try {
      const response = await categoriesApi.create(
        { name: newCategoryName.trim() },
        session.accessToken
      );

      if (response.success && response.data) {
        setCategories([...categories, response.data]);
        setNewCategoryName('');
        setShowCategoryInput(false);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await categoriesApi.delete(id, session.accessToken);
      if (response.success) {
        setCategories(categories.filter((c) => c.id !== id));
        if (selectedCategory === id) {
          setSelectedCategory(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = terminals.findIndex((t) => t.id === active.id);
      const newIndex = terminals.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(terminals, oldIndex, newIndex);
      setTerminals(newOrder);

      // Save new order to backend
      if (session?.accessToken) {
        try {
          await terminalsApi.reorder(
            { terminalIds: newOrder.map((t) => t.id) },
            session.accessToken
          );
        } catch (error) {
          console.error('Failed to save order:', error);
        }
      }
    }
  };

  // Filter terminals by selected category
  const filteredTerminals = selectedCategory
    ? terminals.filter((t) => t.categoryId === selectedCategory)
    : terminals;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-24 bg-muted rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Terminals</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Claude Code terminal sessions
          </p>
        </div>
        <button
          onClick={handleCreateTerminal}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          <Plus size={18} />
          {creating ? 'Creating...' : 'New Terminal'}
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedCategory === null
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({terminals.length})
        </button>

        {categories.map((category) => (
          <div key={category.id} className="relative group">
            <button
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor:
                  selectedCategory === category.id ? category.color : undefined,
              }}
            >
              <Folder size={14} />
              {category.name}
              <span className="opacity-60">
                ({terminals.filter((t) => t.categoryId === category.id).length})
              </span>
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {showCategoryInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="px-3 py-2 rounded-full text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory();
                if (e.key === 'Escape') {
                  setShowCategoryInput(false);
                  setNewCategoryName('');
                }
              }}
            />
            <button
              onClick={handleCreateCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setShowCategoryInput(false);
                setNewCategoryName('');
              }}
              className="p-2 bg-muted rounded-full hover:bg-muted/80"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCategoryInput(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-dashed border-border"
          >
            <FolderPlus size={14} />
            Add Category
          </button>
        )}
      </div>

      {/* Terminal grid */}
      {filteredTerminals.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <TerminalIcon size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            {selectedCategory ? 'No terminals in this category' : 'No terminals yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {selectedCategory
              ? 'Create a terminal and assign it to this category'
              : 'Create your first terminal to get started'}
          </p>
          <button
            onClick={handleCreateTerminal}
            disabled={creating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Plus size={18} />
            Create Terminal
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredTerminals.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTerminals.map((terminal, index) => (
                <div
                  key={terminal.id}
                  className="slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <SortableTerminalCard
                    terminal={terminal}
                    onDelete={handleDeleteTerminal}
                    onRename={handleRenameTerminal}
                    isDark={isDark}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete Confirmation Modal */}
      {terminalToDelete && (
        <DeleteConfirmModal
          terminal={terminalToDelete}
          onConfirm={confirmDeleteTerminal}
          onCancel={() => setTerminalToDelete(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}
