'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Terminal,
  Folder,
  Code,
  Settings2,
  Star,
} from 'lucide-react';
import { profilesApi, TerminalProfile } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSelectProfile?: (profile: TerminalProfile) => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

const PRESET_ICONS = [
  'terminal',
  'code',
  'folder',
  'server',
  'database',
  'cloud',
  'git',
  'npm',
  'docker',
  'python',
];

export function ProfilesModal({ isOpen, onClose, token, onSelectProfile }: ProfilesModalProps) {
  const [profiles, setProfiles] = useState<TerminalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('terminal');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formDescription, setFormDescription] = useState('');
  const [formCols, setFormCols] = useState(120);
  const [formRows, setFormRows] = useState(30);
  const [formCwd, setFormCwd] = useState('');
  const [formShell, setFormShell] = useState('');
  const [formEnv, setFormEnv] = useState('');
  const [formInitCommands, setFormInitCommands] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await profilesApi.list(token);
      if (response.success && response.data) {
        setProfiles(response.data.profiles);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen, loadProfiles]);

  const parseEnv = (envString: string): Record<string, string> | undefined => {
    if (!envString.trim()) return undefined;
    const env: Record<string, string> = {};
    envString.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    return Object.keys(env).length > 0 ? env : undefined;
  };

  const handleCreate = async () => {
    try {
      const response = await profilesApi.create(
        {
          name: formName,
          icon: formIcon || undefined,
          color: formColor,
          description: formDescription || undefined,
          cols: formCols,
          rows: formRows,
          cwd: formCwd || undefined,
          shell: formShell || undefined,
          env: parseEnv(formEnv),
          initCommands: formInitCommands
            ? formInitCommands.split('\n').filter((c) => c.trim())
            : undefined,
          isDefault: formIsDefault,
        },
        token
      );
      if (response.success) {
        loadProfiles();
        resetForm();
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingProfile) return;
    try {
      const response = await profilesApi.update(
        editingProfile.id,
        {
          name: formName,
          icon: formIcon || null,
          color: formColor,
          description: formDescription || null,
          cols: formCols,
          rows: formRows,
          cwd: formCwd || null,
          shell: formShell || null,
          env: parseEnv(formEnv) || null,
          initCommands: formInitCommands
            ? formInitCommands.split('\n').filter((c) => c.trim())
            : [],
          isDefault: formIsDefault,
        },
        token
      );
      if (response.success) {
        loadProfiles();
        resetForm();
        setEditingProfile(null);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    try {
      const response = await profilesApi.delete(id, token);
      if (response.success) {
        loadProfiles();
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const startEditing = (profile: TerminalProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormIcon(profile.icon || 'terminal');
    setFormColor(profile.color);
    setFormDescription(profile.description || '');
    setFormCols(profile.cols);
    setFormRows(profile.rows);
    setFormCwd(profile.cwd || '');
    setFormShell(profile.shell || '');
    setFormEnv(
      profile.env
        ? Object.entries(profile.env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        : ''
    );
    setFormInitCommands(profile.initCommands.join('\n'));
    setFormIsDefault(profile.isDefault);
    setIsCreating(false);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
    setEditingProfile(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormIcon('terminal');
    setFormColor('#6366f1');
    setFormDescription('');
    setFormCols(120);
    setFormRows(30);
    setFormCwd('');
    setFormShell('');
    setFormEnv('');
    setFormInitCommands('');
    setFormIsDefault(false);
  };

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'code':
        return Code;
      case 'folder':
        return Folder;
      case 'settings':
        return Settings2;
      default:
        return Terminal;
    }
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const isEditing = editingProfile || isCreating;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Terminal Profiles</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isEditing ? (
            /* Edit/Create form */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Profile Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Profile"
                    className="w-full px-3 py-2 bg-muted rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-muted rounded text-sm"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform',
                        formColor === color
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Terminal size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Columns</label>
                  <input
                    type="number"
                    value={formCols}
                    onChange={(e) => setFormCols(parseInt(e.target.value) || 120)}
                    min={40}
                    max={500}
                    className="w-full px-3 py-2 bg-muted rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rows</label>
                  <input
                    type="number"
                    value={formRows}
                    onChange={(e) => setFormRows(parseInt(e.target.value) || 30)}
                    min={10}
                    max={200}
                    className="w-full px-3 py-2 bg-muted rounded text-sm"
                  />
                </div>
              </div>

              {/* Shell settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Working Directory</label>
                  <input
                    type="text"
                    value={formCwd}
                    onChange={(e) => setFormCwd(e.target.value)}
                    placeholder="/path/to/directory"
                    className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Shell</label>
                  <input
                    type="text"
                    value={formShell}
                    onChange={(e) => setFormShell(e.target.value)}
                    placeholder="/bin/zsh"
                    className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
                  />
                </div>
              </div>

              {/* Environment variables */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Environment Variables (KEY=value, one per line)
                </label>
                <textarea
                  value={formEnv}
                  onChange={(e) => setFormEnv(e.target.value)}
                  placeholder="NODE_ENV=development&#10;DEBUG=true"
                  rows={3}
                  className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
                />
              </div>

              {/* Init commands */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Startup Commands (one per line)
                </label>
                <textarea
                  value={formInitCommands}
                  onChange={(e) => setFormInitCommands(e.target.value)}
                  placeholder="source ~/.zshrc&#10;nvm use 18&#10;cd ~/projects"
                  rows={3}
                  className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
                />
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isDefault" className="text-sm">
                  Set as default profile for new terminals
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingProfile(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm hover:bg-muted rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={editingProfile ? handleUpdate : handleCreate}
                  disabled={!formName}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingProfile ? 'Update Profile' : 'Create Profile'}
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Loading profiles...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Create new button */}
              <button
                onClick={startCreating}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-primary hover:text-primary transition-colors"
              >
                <Plus size={20} />
                Create New Profile
              </button>

              {/* Profiles list */}
              {profiles.map((profile) => {
                const IconComponent = getIconComponent(profile.icon || 'terminal');
                return (
                  <div
                    key={profile.id}
                    className="group flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => onSelectProfile?.(profile)}
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: profile.color + '20' }}
                    >
                      <IconComponent size={24} style={{ color: profile.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{profile.name}</h3>
                        {profile.isDefault && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                            <Star size={12} />
                            Default
                          </span>
                        )}
                      </div>
                      {profile.description && (
                        <p className="text-sm text-muted-foreground">{profile.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{profile.cols}x{profile.rows}</span>
                        {profile.shell && <span>{profile.shell}</span>}
                        {profile.cwd && <span>{profile.cwd}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(profile);
                        }}
                        className="p-2 hover:bg-background rounded"
                        title="Edit profile"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(profile.id);
                        }}
                        className="p-2 hover:bg-background rounded text-destructive"
                        title="Delete profile"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {profiles.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No profiles yet. Create one to get started!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
