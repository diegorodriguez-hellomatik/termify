'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Layers,
  Check,
  Folder,
  Briefcase,
  Wrench,
  Rocket,
  Home,
  Settings,
  Laptop,
  Globe,
  Star,
  Flame,
  Lightbulb,
  Code,
  Database,
  Server,
  Cloud,
  Terminal,
  Box,
  Zap,
  Shield,
  Lock,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Workspace } from '@/lib/api';

interface WorkspaceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace?: Workspace | null; // null = create mode, workspace = edit mode
}

// Predefined colors
const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#64748b', // slate
];

// Predefined icons using Lucide icon names
const ICON_OPTIONS: { name: string | null; Icon: React.FC<{ className?: string; size?: number; style?: React.CSSProperties }> | null }[] = [
  { name: null, Icon: null }, // No icon (use default Layers)
  { name: 'folder', Icon: Folder },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'wrench', Icon: Wrench },
  { name: 'rocket', Icon: Rocket },
  { name: 'home', Icon: Home },
  { name: 'settings', Icon: Settings },
  { name: 'laptop', Icon: Laptop },
  { name: 'globe', Icon: Globe },
  { name: 'star', Icon: Star },
  { name: 'flame', Icon: Flame },
  { name: 'lightbulb', Icon: Lightbulb },
  { name: 'code', Icon: Code },
  { name: 'database', Icon: Database },
  { name: 'server', Icon: Server },
  { name: 'cloud', Icon: Cloud },
  { name: 'terminal', Icon: Terminal },
  { name: 'box', Icon: Box },
  { name: 'zap', Icon: Zap },
  { name: 'shield', Icon: Shield },
  { name: 'lock', Icon: Lock },
  { name: 'key', Icon: Key },
];

// Get icon component from name
const getIconComponent = (iconName: string | null) => {
  if (!iconName) return null;
  const found = ICON_OPTIONS.find((opt) => opt.name === iconName);
  return found?.Icon || null;
};

export function WorkspaceEditModal({
  isOpen,
  onClose,
  workspace,
}: WorkspaceEditModalProps) {
  const { createWorkspace, updateWorkspace, switchWorkspace } = useWorkspace();

  const isEditMode = !!workspace;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset form when modal opens/closes or workspace changes
  useEffect(() => {
    if (isOpen) {
      if (workspace) {
        setName(workspace.name);
        setDescription(workspace.description || '');
        setColor(workspace.color || '#6366f1');
        setIcon(workspace.icon || null);
        setIsDefault(workspace.isDefault);
      } else {
        setName('');
        setDescription('');
        setColor('#6366f1');
        setIcon(null);
        setIsDefault(false);
      }
      setError('');
    }
  }, [isOpen, workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditMode && workspace) {
        await updateWorkspace(workspace.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          isDefault,
        });
      } else {
        const newWorkspace = await createWorkspace({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon: icon || undefined,
        });

        // If created successfully and isDefault, update it
        if (newWorkspace && isDefault) {
          await updateWorkspace(newWorkspace.id, { isDefault: true });
        }

        // Switch to the new workspace
        if (newWorkspace) {
          await switchWorkspace(newWorkspace.id);
        }
      }

      onClose();
    } catch (err) {
      setError('Failed to save workspace');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-100"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEditMode ? 'Edit Workspace' : 'Create Workspace'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Name & Description row */}
            <div className="flex gap-3">
              {/* Preview */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color + '20' }}
              >
                {(() => {
                  const IconComp = getIconComponent(icon);
                  return IconComp ? (
                    <IconComp className="h-6 w-6" style={{ color }} />
                  ) : (
                    <Layers className="h-6 w-6" style={{ color }} />
                  );
                })()}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  id="workspace-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Workspace name *"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                    error && 'border-destructive'
                  )}
                  autoFocus
                />
                <input
                  id="workspace-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-md transition-all flex items-center justify-center',
                      color === c && 'ring-2 ring-offset-1 ring-offset-card'
                    )}
                    style={{ backgroundColor: c, '--tw-ring-color': c } as React.CSSProperties}
                  >
                    {color === c && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
                {/* Custom color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 w-7 h-7 opacity-0 cursor-pointer"
                  />
                  <div
                    className={cn(
                      'w-7 h-7 rounded-md border-2 border-dashed flex items-center justify-center transition-all',
                      !COLORS.includes(color) ? 'ring-2 ring-offset-1 ring-offset-card border-transparent' : 'border-border'
                    )}
                    style={{
                      backgroundColor: !COLORS.includes(color) ? color : 'transparent',
                      '--tw-ring-color': color
                    } as React.CSSProperties}
                  >
                    {!COLORS.includes(color) ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <span className="text-xs text-muted-foreground">+</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((opt, index) => {
                  const IconComp = opt.Icon;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setIcon(opt.name)}
                      className={cn(
                        'w-8 h-8 rounded-md border transition-all flex items-center justify-center',
                        icon === opt.name
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground/50 hover:bg-muted'
                      )}
                    >
                      {IconComp ? (
                        <IconComp className="h-4 w-4" style={{ color: icon === opt.name ? color : undefined }} />
                      ) : (
                        <Layers className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default workspace toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm font-medium">Default workspace</p>
                <p className="text-xs text-muted-foreground">Opens automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDefault(!isDefault)}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  isDefault ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    isDefault && 'translate-x-5'
                  )}
                />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-primary text-primary-foreground hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {saving ? 'Saving...' : isEditMode ? 'Save changes' : 'Create workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
