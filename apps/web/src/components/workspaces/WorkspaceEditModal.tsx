'use client';

import { useState, useEffect } from 'react';
import { X, Folder, Briefcase, Rocket, Home, Code, Database, Server, Cloud, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const WORKSPACE_ICONS = [
  { name: 'folder', icon: Folder },
  { name: 'briefcase', icon: Briefcase },
  { name: 'rocket', icon: Rocket },
  { name: 'home', icon: Home },
  { name: 'code', icon: Code },
  { name: 'database', icon: Database },
  { name: 'server', icon: Server },
  { name: 'cloud', icon: Cloud },
  { name: 'zap', icon: Zap },
];

const WORKSPACE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

interface WorkspaceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
}

export function WorkspaceEditModal({
  isOpen,
  onClose,
  workspace,
}: WorkspaceEditModalProps) {
  const { createWorkspace, updateWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(WORKSPACE_COLORS[0]);
  const [icon, setIcon] = useState('folder');
  const [loading, setLoading] = useState(false);

  const isEditing = !!workspace;

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || '');
      setColor(workspace.color || WORKSPACE_COLORS[0]);
      setIcon(workspace.icon || 'folder');
    } else {
      setName('');
      setDescription('');
      setColor(WORKSPACE_COLORS[0]);
      setIcon('folder');
    }
  }, [workspace, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (isEditing && workspace) {
        await updateWorkspace(workspace.id, { name, description, color, icon });
      } else {
        await createWorkspace({ name, description, color, icon });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? 'Edit Workspace' : 'Create Workspace'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_ICONS.map(({ name: iconName, icon: IconComp }) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={`p-2 rounded-md transition-all ${
                    icon === iconName
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <IconComp size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
