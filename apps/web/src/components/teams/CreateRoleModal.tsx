'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeamRoles } from '@/hooks/useTeamRoles';
import { TeamCustomRole, TeamPermission } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CreateRoleModalProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole?: TeamCustomRole | null;
  onSuccess: () => void;
}

const ROLE_COLORS = [
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

// Permission categories for display
const PERMISSION_CATEGORIES = {
  Terminals: [
    { key: TeamPermission.CREATE_TERMINAL, label: 'Create terminals' },
    { key: TeamPermission.EDIT_TERMINAL, label: 'Edit terminals' },
    { key: TeamPermission.DELETE_TERMINAL, label: 'Delete terminals' },
    { key: TeamPermission.SHARE_TERMINAL, label: 'Share terminals' },
  ],
  Workspaces: [
    { key: TeamPermission.CREATE_WORKSPACE, label: 'Create workspaces' },
    { key: TeamPermission.EDIT_WORKSPACE, label: 'Edit workspaces' },
    { key: TeamPermission.DELETE_WORKSPACE, label: 'Delete workspaces' },
  ],
  Snippets: [
    { key: TeamPermission.CREATE_SNIPPET, label: 'Create snippets' },
    { key: TeamPermission.EDIT_SNIPPET, label: 'Edit snippets' },
    { key: TeamPermission.DELETE_SNIPPET, label: 'Delete snippets' },
  ],
  Servers: [
    { key: TeamPermission.CREATE_SERVER, label: 'Add servers' },
    { key: TeamPermission.EDIT_SERVER, label: 'Edit servers' },
    { key: TeamPermission.DELETE_SERVER, label: 'Delete servers' },
  ],
  Members: [
    { key: TeamPermission.INVITE_MEMBER, label: 'Invite members' },
    { key: TeamPermission.REMOVE_MEMBER, label: 'Remove members' },
    { key: TeamPermission.CHANGE_MEMBER_ROLE, label: 'Change member roles' },
  ],
  Tasks: [
    { key: TeamPermission.CREATE_TASK, label: 'Create tasks' },
    { key: TeamPermission.EDIT_TASK, label: 'Edit tasks' },
    { key: TeamPermission.DELETE_TASK, label: 'Delete tasks' },
    { key: TeamPermission.ASSIGN_TASK, label: 'Assign tasks' },
  ],
  Settings: [
    { key: TeamPermission.EDIT_TEAM_SETTINGS, label: 'Edit team settings' },
    { key: TeamPermission.MANAGE_ROLES, label: 'Manage roles' },
    { key: TeamPermission.VIEW_AUDIT_LOG, label: 'View audit log' },
    { key: TeamPermission.VIEW_HISTORY, label: 'View command history' },
  ],
};

export function CreateRoleModal({
  teamId,
  open,
  onOpenChange,
  editingRole,
  onSuccess,
}: CreateRoleModalProps) {
  const { createRole, updateRole } = useTeamRoles(teamId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name);
      setDescription(editingRole.description || '');
      setColor(editingRole.color);
      setSelectedPermissions(new Set(editingRole.permissions));
    } else {
      setName('');
      setDescription('');
      setColor(ROLE_COLORS[0]);
      setSelectedPermissions(new Set());
    }
  }, [editingRole, open]);

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    const categoryPermissions = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES];
    const allSelected = categoryPermissions.every((p) => selectedPermissions.has(p.key));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      categoryPermissions.forEach((p) => {
        if (allSelected) {
          next.delete(p.key);
        } else {
          next.add(p.key);
        }
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    if (selectedPermissions.size === 0) {
      setError('Select at least one permission');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        permissions: Array.from(selectedPermissions),
      };

      const result = editingRole
        ? await updateRole(editingRole.id, data)
        : await createRole(data);

      if (result.success) {
        onSuccess();
      } else {
        setError((result.error as string) || 'Failed to save role');
      }
    } catch (err) {
      setError('Failed to save role');
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
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-2xl p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold mb-4">
          {editingRole ? 'Edit Role' : 'Create Custom Role'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Role Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Developer"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can manage terminals and servers"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  disabled={loading}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Permissions</label>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                const selectedCount = permissions.filter((p) =>
                  selectedPermissions.has(p.key)
                ).length;
                const allSelected = selectedCount === permissions.length;

                return (
                  <div key={category} className="border rounded-lg p-3">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full text-left mb-2"
                      onClick={() => toggleCategory(category)}
                      disabled={loading}
                    >
                      <span className="font-medium text-sm">{category}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedCount}/{permissions.length}
                      </span>
                    </button>
                    <div className="space-y-1">
                      {permissions.map((perm) => {
                        const selected = selectedPermissions.has(perm.key);
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            className={cn(
                              'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                              selected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted'
                            )}
                            onClick={() => togglePermission(perm.key)}
                            disabled={loading}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center',
                                selected
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground/50'
                              )}
                            >
                              {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            {perm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
