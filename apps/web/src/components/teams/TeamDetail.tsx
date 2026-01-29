'use client';

import { useState } from 'react';
import {
  Users,
  ListTodo,
  Settings,
  Trash2,
  UserPlus,
  Crown,
  ChevronLeft,
  Pencil,
  Loader2,
  Terminal,
  Layout,
  Code2,
  Server,
  History,
  Activity,
  Bell,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { Team, TeamRole } from '@/lib/api';
import { TeamMembers } from './TeamMembers';
import { InviteMemberModal } from './InviteMemberModal';
import { TeamTerminalsList } from './TeamTerminalsList';
import { TeamWorkspacesList } from './TeamWorkspacesList';
import { TeamSnippetsList } from './TeamSnippetsList';
import { TeamServersList } from './TeamServersList';
import { TeamHistoryPage } from './TeamHistoryPage';
import { TeamAuditLogs } from './TeamAuditLogs';
import { TeamDashboard } from './TeamDashboard';
import { TeamNotificationSettings } from './TeamNotificationSettings';

interface TeamDetailProps {
  team: Team;
  onBack: () => void;
  onUpdateTeam: (id: string, data: { name?: string; description?: string | null; color?: string }) => Promise<Team | null>;
  onDeleteTeam: (id: string) => Promise<boolean>;
  onInviteMember: (email: string, role?: 'ADMIN' | 'MEMBER') => Promise<any>;
  onUpdateMemberRole: (memberId: string, role: 'ADMIN' | 'MEMBER') => Promise<any>;
  onRemoveMember: (memberId: string) => Promise<boolean>;
  onViewTasks: () => void;
}

const TEAM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export function TeamDetail({
  team,
  onBack,
  onUpdateTeam,
  onDeleteTeam,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
  onViewTasks,
}: TeamDetailProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [color, setColor] = useState(team.color);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'members' | 'terminals' | 'workspaces' | 'snippets' | 'servers' | 'history' | 'audit' | 'dashboard' | 'notifications' | 'settings'
  >('overview');

  const canEdit = team.role === 'OWNER' || team.role === 'ADMIN';
  const canDelete = team.role === 'OWNER';
  const canInvite = team.role === 'OWNER' || team.role === 'ADMIN';

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const success = await onDeleteTeam(team.id);
      if (success) {
        onBack();
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold"
            style={{ backgroundColor: color || '#6366f1' }}
          >
            {team.icon || team.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{team.name}</h1>
            {team.description && (
              <p className="text-sm text-muted-foreground">{team.description}</p>
            )}
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setActiveTab('settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={<Activity className="h-4 w-4" />}
        >
          Overview
        </TabButton>
        <TabButton
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
          icon={<Activity className="h-4 w-4" />}
        >
          Dashboard
        </TabButton>
        <TabButton
          active={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          icon={<Users className="h-4 w-4" />}
        >
          Members
        </TabButton>
        <TabButton
          active={activeTab === 'terminals'}
          onClick={() => setActiveTab('terminals')}
          icon={<Terminal className="h-4 w-4" />}
        >
          Terminals
        </TabButton>
        <TabButton
          active={activeTab === 'workspaces'}
          onClick={() => setActiveTab('workspaces')}
          icon={<Layout className="h-4 w-4" />}
        >
          Workspaces
        </TabButton>
        <TabButton
          active={activeTab === 'snippets'}
          onClick={() => setActiveTab('snippets')}
          icon={<Code2 className="h-4 w-4" />}
        >
          Snippets
        </TabButton>
        <TabButton
          active={activeTab === 'servers'}
          onClick={() => setActiveTab('servers')}
          icon={<Server className="h-4 w-4" />}
        >
          Servers
        </TabButton>
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={<History className="h-4 w-4" />}
        >
          History
        </TabButton>
        {canEdit && (
          <>
            <TabButton
              active={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              icon={<Shield className="h-4 w-4" />}
            >
              Audit
            </TabButton>
            <TabButton
              active={activeTab === 'notifications'}
              onClick={() => setActiveTab('notifications')}
              icon={<Bell className="h-4 w-4" />}
            >
              Notifications
            </TabButton>
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="h-4 w-4" />}
            >
              Settings
            </TabButton>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Members</span>
                </div>
                <p className="text-2xl font-semibold">{team.memberCount}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ListTodo className="h-4 w-4" />
                  <span className="text-sm">Tasks</span>
                </div>
                <p className="text-2xl font-semibold">{team.taskCount}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onViewTasks}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  View Tasks
                </Button>
                {canInvite && (
                  <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <TeamDashboard teamId={team.id} />
        )}

        {activeTab === 'members' && (
          <TeamMembers
            members={team.members || []}
            currentUserRole={team.role}
            onInvite={canInvite ? () => setInviteModalOpen(true) : undefined}
            onUpdateRole={canEdit ? onUpdateMemberRole : undefined}
            onRemove={canEdit ? onRemoveMember : undefined}
          />
        )}

        {activeTab === 'terminals' && (
          <TeamTerminalsList
            teamId={team.id}
            canManage={canEdit}
          />
        )}

        {activeTab === 'workspaces' && (
          <TeamWorkspacesList
            teamId={team.id}
            canManage={canEdit}
          />
        )}

        {activeTab === 'snippets' && (
          <TeamSnippetsList
            teamId={team.id}
            canManage={canEdit}
          />
        )}

        {activeTab === 'servers' && (
          <TeamServersList
            teamId={team.id}
            canManage={canEdit}
          />
        )}

        {activeTab === 'history' && (
          <TeamHistoryPage teamId={team.id} />
        )}

        {activeTab === 'audit' && canEdit && (
          <TeamAuditLogs teamId={team.id} />
        )}

        {activeTab === 'notifications' && canEdit && (
          <TeamNotificationSettings teamId={team.id} />
        )}

        {activeTab === 'settings' && canEdit && (
          <div className="space-y-6">
            {/* Edit Team */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Team Settings</h3>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Team Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this team for?"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                      disabled={saving}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>

            {/* Danger Zone */}
            {canDelete && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Deleting a team will remove all tasks and member associations.
                  This action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={onInviteMember}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Team"
        itemName={team.name}
        itemType="team"
        description="This will remove all tasks and member associations."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
