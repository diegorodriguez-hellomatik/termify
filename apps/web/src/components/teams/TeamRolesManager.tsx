'use client';

import { useState } from 'react';
import {
  Plus,
  Shield,
  Loader2,
  MoreVertical,
  Edit3,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTeamRoles } from '@/hooks/useTeamRoles';
import { TeamCustomRole, TeamPermission } from '@/lib/api';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { CreateRoleModal } from './CreateRoleModal';
import { cn } from '@/lib/utils';

interface TeamRolesManagerProps {
  teamId: string;
  canManage: boolean;
}

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

export function TeamRolesManager({ teamId, canManage }: TeamRolesManagerProps) {
  const { roles, loading, error, refetch, deleteRole } = useTeamRoles(teamId);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TeamCustomRole | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamCustomRole | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const toggleExpanded = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleDeleteClick = (role: TeamCustomRole) => {
    setMenuOpenId(null);
    setSelectedRole(role);
    setDeleteModalOpen(true);
  };

  const handleEditClick = (role: TeamCustomRole) => {
    setMenuOpenId(null);
    setEditingRole(role);
    setCreateModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    await deleteRole(selectedRole.id);
    setDeleteModalOpen(false);
    setSelectedRole(null);
  };

  const handleModalClose = () => {
    setCreateModalOpen(false);
    setEditingRole(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Custom Roles</h3>
            <p className="text-sm text-muted-foreground">
              Create custom roles with specific permissions for team members.
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Create Role
          </Button>
        </div>
      )}

      {/* Built-in Roles Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Built-in Roles
          </h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Owner</div>
              <p className="text-xs text-muted-foreground">
                Full access to all team features. Cannot be modified.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Admin</div>
              <p className="text-xs text-muted-foreground">
                Can manage members, resources, and most settings.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Member</div>
              <p className="text-xs text-muted-foreground">
                Basic access. Can view and use shared resources.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Roles */}
      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h4 className="font-medium mb-1">No custom roles</h4>
          <p className="text-sm text-muted-foreground text-center">
            Create custom roles to give team members specific permissions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <Card key={role.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpanded(role.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <div>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {role.permissions.length} permissions
                    </span>
                    {canManage && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === role.id ? null : role.id);
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {menuOpenId === role.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-background border rounded-md shadow-lg z-50 py-1">
                              <button
                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(role);
                                }}
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(role);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {expandedRoles.has(role.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {expandedRoles.has(role.id) && (
                <div className="border-t p-4 bg-muted/30">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                      const enabledCount = permissions.filter((p) =>
                        role.permissions.includes(p.key)
                      ).length;
                      if (enabledCount === 0) return null;

                      return (
                        <div key={category}>
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            {category}
                          </div>
                          <div className="space-y-1">
                            {permissions.map((perm) => {
                              const enabled = role.permissions.includes(perm.key);
                              if (!enabled) return null;
                              return (
                                <div
                                  key={perm.key}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <Check className="h-3 w-3 text-green-500" />
                                  {perm.label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CreateRoleModal
        teamId={teamId}
        open={createModalOpen}
        onOpenChange={handleModalClose}
        editingRole={editingRole}
        onSuccess={() => {
          refetch();
          handleModalClose();
        }}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Role"
        itemName={selectedRole?.name || 'role'}
        itemType="role"
        description="Members with this role will lose their custom permissions and revert to their base role."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedRole(null);
        }}
      />
    </div>
  );
}
