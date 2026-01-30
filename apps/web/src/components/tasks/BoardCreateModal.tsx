'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PersonalTaskBoard } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BoardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    color: string;
    icon?: string | null;
  }) => Promise<PersonalTaskBoard | null>;
  editBoard?: PersonalTaskBoard | null;
  onUpdate?: (id: string, data: {
    name?: string;
    color?: string;
    icon?: string | null;
  }) => Promise<PersonalTaskBoard | null>;
}

const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6b7280', // Gray
];

const ICONS = ['', '📋', '💼', '🏠', '🎯', '🚀', '💡', '⭐', '🔥', '📝', '🎨', '🛠️'];

export function BoardCreateModal({
  open,
  onOpenChange,
  onCreate,
  editBoard,
  onUpdate,
}: BoardCreateModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const isEditing = !!editBoard;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (editBoard) {
      setName(editBoard.name);
      setColor(editBoard.color);
      setIcon(editBoard.icon || '');
    } else {
      setName('');
      setColor('#6366f1');
      setIcon('');
    }
  }, [editBoard, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Board name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let result;
      if (isEditing && onUpdate) {
        result = await onUpdate(editBoard.id, {
          name: name.trim(),
          color,
          icon: icon || null,
        });
      } else {
        result = await onCreate({
          name: name.trim(),
          color,
          icon: icon || null,
        });
      }

      if (result) {
        setName('');
        setColor('#6366f1');
        setIcon('');
        onOpenChange(false);
      } else {
        setError(`Failed to ${isEditing ? 'update' : 'create'} board`);
      }
    } catch {
      setError(`Failed to ${isEditing ? 'update' : 'create'} board`);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Board' : 'Create Board'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Work, Personal, Project X"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color === c
                        ? 'ring-2 ring-offset-2 ring-primary'
                        : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Icon (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((i, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      'w-10 h-10 rounded-lg border flex items-center justify-center text-lg transition-colors',
                      icon === i
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground'
                    )}
                    onClick={() => setIcon(i)}
                    disabled={loading}
                  >
                    {i || '—'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Preview</label>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: color }}
              >
                {icon && <span>{icon}</span>}
                {name || 'Board Name'}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Board' : 'Create Board'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
