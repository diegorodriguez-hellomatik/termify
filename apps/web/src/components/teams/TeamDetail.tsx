'use client';

import { useState } from 'react';
import {
  Users,
  ListTodo,
  Settings,
  Trash2,
  UserPlus,
  ChevronLeft,
  Loader2,
  Terminal,
  Layout,
  Code2,
  Server,
  History,
  Activity,
  FolderOpen,
  Plus,
  ArrowRight,
  Clock,
  Zap,
  Camera,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { Team } from '@/lib/api';
import { TeamMembers } from './TeamMembers';
import { InviteMemberModal } from './InviteMemberModal';
import { TeamTerminalsList } from './TeamTerminalsList';
import { TeamWorkspacesList } from './TeamWorkspacesList';
import { TeamSnippetsList } from './TeamSnippetsList';
import { TeamServersList } from './TeamServersList';
import { TeamHistoryPage } from './TeamHistoryPage';
import { TeamAuditLogs } from './TeamAuditLogs';
import { TeamNotificationSettings } from './TeamNotificationSettings';
import { TeamRolesManager } from './TeamRolesManager';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useTeamHistory } from '@/hooks/useTeamHistory';

interface TeamDetailProps {
  team: Team;
  onBack: () => void;
  onUpdateTeam: (id: string, data: { name?: string; description?: string | null; color?: string; image?: string | null }) => Promise<Team | null>;
  onDeleteTeam: (id: string) => Promise<boolean>;
  onInviteMember: (email: string, role?: 'ADMIN' | 'MEMBER') => Promise<any>;
  onUpdateMemberRole: (memberId: string, role: 'ADMIN' | 'MEMBER') => Promise<any>;
  onRemoveMember: (memberId: string) => Promise<boolean>;
  onUploadTeamImage?: (file: File) => Promise<string | null>;
  onViewTasks: () => void;
}

const TEAM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

type TabType = 'overview' | 'resources' | 'members' | 'activity' | 'settings';
type ResourceSubTab = 'terminals' | 'workspaces' | 'snippets' | 'servers';

export function TeamDetail({
  team,
  onBack,
  onUpdateTeam,
  onDeleteTeam,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
  onUploadTeamImage,
  onViewTasks,
}: TeamDetailProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [color, setColor] = useState(team.color);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [resourceSubTab, setResourceSubTab] = useState<ResourceSubTab>('terminals');
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Fetch presence and recent activity for overview
  const { presence } = useTeamPresence(team.id);
  const { history } = useTeamHistory(team.id);

  const canEdit = team.role === 'OWNER' || team.role === 'ADMIN';
  const canDelete = team.role === 'OWNER';
  const canInvite = team.role === 'OWNER' || team.role === 'ADMIN';

  const onlineMembers = presence.filter(p => p.status === 'online');
  const recentActivity = history.slice(0, 5);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadTeamImage) return;

    setUploadingImage(true);
    try {
      await onUploadTeamImage(file);
    } finally {
      setUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveImage = async () => {
    setSaving(true);
    try {
      await onUpdateTeam(team.id, { image: null });
    } finally {
      setSaving(false);
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
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold overflow-hidden"
            style={{ backgroundColor: team.image ? undefined : (color || '#6366f1') }}
          >
            {team.image ? (
              <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              team.icon || team.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{team.name}</h1>
            {team.description && (
              <p className="text-sm text-muted-foreground truncate">{team.description}</p>
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

      {/* Tabs - Consolidated to 5 */}
      <div className="flex gap-1 border-b mb-4">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={<Activity className="h-4 w-4" />}
        >
          Overview
        </TabButton>
        <TabButton
          active={activeTab === 'resources'}
          onClick={() => setActiveTab('resources')}
          icon={<FolderOpen className="h-4 w-4" />}
        >
          Resources
        </TabButton>
        <TabButton
          active={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          icon={<Users className="h-4 w-4" />}
        >
          Members
        </TabButton>
        <TabButton
          active={activeTab === 'activity'}
          onClick={() => setActiveTab('activity')}
          icon={<History className="h-4 w-4" />}
        >
          Activity
        </TabButton>
        {canEdit && (
          <TabButton
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="h-4 w-4" />}
          >
            Settings
          </TabButton>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Overview Tab - Enhanced */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Members"
                value={team.memberCount || 0}
                subtext={onlineMembers.length > 0 ? `${onlineMembers.length} online` : undefined}
                onClick={() => setActiveTab('members')}
              />
              <StatCard
                icon={<ListTodo className="h-4 w-4" />}
                label="Tasks"
                value={team.taskCount || 0}
                onClick={onViewTasks}
              />
              <StatCard
                icon={<Terminal className="h-4 w-4" />}
                label="Terminals"
                value="-"
                onClick={() => { setActiveTab('resources'); setResourceSubTab('terminals'); }}
              />
              <StatCard
                icon={<Code2 className="h-4 w-4" />}
                label="Snippets"
                value="-"
                onClick={() => { setActiveTab('resources'); setResourceSubTab('snippets'); }}
              />
            </div>

            {/* Online Members */}
            {onlineMembers.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Online Now
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onlineMembers.slice(0, 8).map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium overflow-hidden">
                          {member.userImage ? (
                            <img
                              src={member.userImage}
                              alt={member.userName || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            member.userName?.charAt(0).toUpperCase() || '?'
                          )}
                        </div>
                        <span className="text-sm">{member.userName}</span>
                        {member.activeTerminalId && (
                          <Terminal className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {onlineMembers.length > 8 && (
                      <span className="text-sm text-muted-foreground px-3 py-1.5">
                        +{onlineMembers.length - 8} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button variant="outline" className="justify-start" onClick={onViewTasks}>
                    <ListTodo className="h-4 w-4 mr-2" />
                    View Tasks
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => { setActiveTab('resources'); setResourceSubTab('terminals'); }}
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    Terminals
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => { setActiveTab('resources'); setResourceSubTab('snippets'); }}
                  >
                    <Code2 className="h-4 w-4 mr-2" />
                    Snippets
                  </Button>
                  {canInvite && (
                    <Button variant="outline" className="justify-start" onClick={() => setInviteModalOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Activity
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setActiveTab('activity')}
                  >
                    View all
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 border-b last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {item.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            <span className="font-medium">{item.user?.name || 'Unknown'}</span>
                            <span className="text-muted-foreground"> ran </span>
                            <code className="text-xs bg-muted px-1 rounded">{item.command.slice(0, 30)}{item.command.length > 30 ? '...' : ''}</code>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(new Date(item.createdAt))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resources Tab - Sub-tabs for different resource types */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            {/* Sub-navigation */}
            <div className="flex gap-2 flex-wrap">
              <SubTabButton
                active={resourceSubTab === 'terminals'}
                onClick={() => setResourceSubTab('terminals')}
                icon={<Terminal className="h-4 w-4" />}
              >
                Terminals
              </SubTabButton>
              <SubTabButton
                active={resourceSubTab === 'workspaces'}
                onClick={() => setResourceSubTab('workspaces')}
                icon={<Layout className="h-4 w-4" />}
              >
                Workspaces
              </SubTabButton>
              <SubTabButton
                active={resourceSubTab === 'snippets'}
                onClick={() => setResourceSubTab('snippets')}
                icon={<Code2 className="h-4 w-4" />}
              >
                Snippets
              </SubTabButton>
              <SubTabButton
                active={resourceSubTab === 'servers'}
                onClick={() => setResourceSubTab('servers')}
                icon={<Server className="h-4 w-4" />}
              >
                Servers
              </SubTabButton>
            </div>

            {/* Resource Content */}
            {resourceSubTab === 'terminals' && (
              <TeamTerminalsList teamId={team.id} canManage={canEdit} />
            )}
            {resourceSubTab === 'workspaces' && (
              <TeamWorkspacesList teamId={team.id} canManage={canEdit} />
            )}
            {resourceSubTab === 'snippets' && (
              <TeamSnippetsList teamId={team.id} canManage={canEdit} />
            )}
            {resourceSubTab === 'servers' && (
              <TeamServersList teamId={team.id} canManage={canEdit} />
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <TeamMembers
            members={team.members || []}
            currentUserRole={team.role}
            onInvite={canInvite ? () => setInviteModalOpen(true) : undefined}
            onUpdateRole={canEdit ? onUpdateMemberRole : undefined}
            onRemove={canEdit ? onRemoveMember : undefined}
          />
        )}

        {/* Activity Tab - History + Audit Logs */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant={!showAuditLogs ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAuditLogs(false)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Command History
                </Button>
                <Button
                  variant={showAuditLogs ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAuditLogs(true)}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Audit Logs
                </Button>
              </div>
            )}
            {showAuditLogs && canEdit ? (
              <TeamAuditLogs teamId={team.id} />
            ) : (
              <TeamHistoryPage teamId={team.id} />
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && canEdit && (
          <div className="space-y-6 max-w-2xl">
            {/* Team Settings */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-medium">Team Settings</h3>

                {/* Team Avatar */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Team Avatar
                  </label>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-semibold overflow-hidden relative group"
                      style={{ backgroundColor: team.image ? undefined : (color || '#6366f1') }}
                    >
                      {team.image ? (
                        <>
                          <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={saving}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="h-6 w-6 text-white" />
                          </button>
                        </>
                      ) : (
                        team.icon || team.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingImage}
                          asChild
                        >
                          <span>
                            {uploadingImage ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Camera className="h-4 w-4 mr-2" />
                            )}
                            Upload Image
                          </span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG or WebP. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

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
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-4">Notification Preferences</h3>
                <TeamNotificationSettings teamId={team.id} />
              </CardContent>
            </Card>

            {/* Custom Roles */}
            <Card>
              <CardContent className="p-4">
                <TeamRolesManager teamId={team.id} canManage={canEdit} />
              </CardContent>
            </Card>

            {/* Danger Zone */}
            {canDelete && (
              <Card className="border-destructive/50">
                <CardContent className="p-4">
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
                </CardContent>
              </Card>
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

// Tab Button Component
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
        'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
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

// Sub Tab Button Component
function SubTabButton({ active, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtext?: string;
  onClick?: () => void;
}

function StatCard({ icon, label, value, subtext, onClick }: StatCardProps) {
  return (
    <button
      className="bg-muted/50 rounded-lg p-4 text-left hover:bg-muted/70 transition-colors w-full"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
      )}
    </button>
  );
}

// Helper function
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
