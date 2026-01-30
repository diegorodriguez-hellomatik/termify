'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, LayoutGrid, Grid3x3, List } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { BlankAreaContextMenu } from '@/components/ui/BlankAreaContextMenu';
import { useTeams } from '@/hooks/useTeams';
import { useTasks } from '@/hooks/useTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useTeamSocket } from '@/hooks/useTeamSocket';
import { useTheme } from '@/context/ThemeContext';
import { TeamList, TeamDetail, TaskBoard, CreateTeamModal } from '@/components/teams';
import { Team, TeamMember, Task, TaskStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'detail' | 'tasks';
type CardViewMode = 'grid' | 'compact' | 'list';

// View Mode Toggle Component
function ViewModeToggle({
  viewMode,
  onChange,
  isDark,
}: {
  viewMode: CardViewMode;
  onChange: (mode: CardViewMode) => void;
  isDark: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg border border-border"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
    >
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'grid'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onChange('compact')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'compact'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Compact view"
      >
        <Grid3x3 size={16} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-1.5 rounded transition-all',
          viewMode === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="List view"
      >
        <List size={16} />
      </button>
    </div>
  );
}

export default function TeamsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { isDark } = useTheme();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('grid');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const {
    teams,
    loading: teamsLoading,
    fetchTeams,
    getTeam,
    createTeam,
    updateTeam,
    uploadTeamImage,
    deleteTeam,
    inviteMember,
    updateMemberRole,
    removeMember,
  } = useTeams();

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    unassignTask,
    reorderTasks,
    tasksByStatus,
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskStatusChanged,
    fetchTasks,
  } = useTasks(selectedTeamId);

  const {
    statuses: teamStatuses,
    isLoading: statusesLoading,
    refetch: refetchStatuses,
  } = useTaskStatuses({ teamId: selectedTeamId || undefined });

  // WebSocket for real-time updates
  useTeamSocket({
    token: accessToken || null,
    teamId: selectedTeamId,
    callbacks: {
      onMemberJoined: (member) => {
        // Refresh team details when member joins
        if (selectedTeamId) loadTeamDetails(selectedTeamId);
      },
      onMemberLeft: (memberId) => {
        // Refresh team details when member leaves
        if (selectedTeamId) loadTeamDetails(selectedTeamId);
      },
      onMemberRoleChanged: (memberId, role) => {
        // Refresh team details when role changes
        if (selectedTeamId) loadTeamDetails(selectedTeamId);
      },
      onTaskCreated: handleTaskCreated,
      onTaskUpdated: handleTaskUpdated,
      onTaskDeleted: handleTaskDeleted,
      onTaskStatusChanged: handleTaskStatusChanged,
    },
  });

  const loadTeamDetails = useCallback(
    async (teamId: string) => {
      const team = await getTeam(teamId);
      if (team) {
        setSelectedTeam(team);
      }
    },
    [getTeam]
  );

  // Load team details when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetails(selectedTeamId);
    } else {
      setSelectedTeam(null);
    }
  }, [selectedTeamId, loadTeamDetails]);

  const handleSelectTeam = (teamId: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedTeamId(teamId);
      setViewMode('detail');
      setTimeout(() => setIsTransitioning(false), 100);
    }, 100);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (viewMode === 'tasks') {
        setViewMode('detail');
      } else {
        setSelectedTeamId(null);
        setSelectedTeam(null);
        setViewMode('list');
      }
      setTimeout(() => setIsTransitioning(false), 100);
    }, 100);
  };

  const handleViewTasks = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode('tasks');
      setTimeout(() => setIsTransitioning(false), 100);
    }, 100);
  };

  const handleCreateTeam = async (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    const team = await createTeam(data);
    if (team) {
      setSelectedTeamId(team.id);
      setViewMode('detail');
    }
    return team;
  };

  const handleDeleteTeam = async (teamId: string) => {
    const success = await deleteTeam(teamId);
    if (success) {
      setSelectedTeamId(null);
      setSelectedTeam(null);
      setViewMode('list');
    }
    return success;
  };

  const handleInviteMember = async (email: string, role?: 'ADMIN' | 'MEMBER') => {
    if (!selectedTeamId) return null;
    const result = await inviteMember(selectedTeamId, { email, role });
    if (result) {
      loadTeamDetails(selectedTeamId);
    }
    return result;
  };

  const handleUpdateMemberRole = async (memberId: string, role: 'ADMIN' | 'MEMBER') => {
    if (!selectedTeamId) return null;
    const result = await updateMemberRole(selectedTeamId, memberId, role);
    if (result) {
      loadTeamDetails(selectedTeamId);
    }
    return result;
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeamId) return false;
    const success = await removeMember(selectedTeamId, memberId);
    if (success) {
      loadTeamDetails(selectedTeamId);
    }
    return success;
  };

  const handleUploadTeamImage = async (file: File) => {
    if (!selectedTeamId) return null;
    const url = await uploadTeamImage(selectedTeamId, file);
    if (url) {
      loadTeamDetails(selectedTeamId);
    }
    return url;
  };

  // Filter teams by search query
  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        team.description?.toLowerCase().includes(query)
    );
  }, [teams, searchQuery]);

  return (
    <PageLayout className={cn(
      'transition-all duration-150',
      isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
    )}>
      {viewMode === 'list' && (
        <>
          <PageHeader
            title="Teams"
            description="Collaborate with your team on tasks and terminals"
            actions={
              <div className="flex items-center gap-3">
                <ViewModeToggle viewMode={cardViewMode} onChange={setCardViewMode} isDark={isDark} />
                <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
                  <Plus size={16} />
                  New Team
                </Button>
              </div>
            }
          />
          <PageContent>
          <div onContextMenu={handleContextMenu} className="min-h-[calc(100vh-220px)]">
            {/* Search bar */}
            {teams.length > 0 && (
              <div className="relative max-w-md mb-4">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teams... (Ctrl+F)"
                  className="w-full h-9 pl-10 pr-8 text-sm rounded-md border border-border bg-background focus:outline-none focus:border-primary focus:shadow-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <TeamList
              teams={filteredTeams}
              loading={teamsLoading}
              selectedTeamId={selectedTeamId}
              onSelectTeam={handleSelectTeam}
              viewMode={cardViewMode}
            />
          </div>

          {/* Context Menu */}
          {contextMenu && (
            <BlankAreaContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onAction={() => setCreateModalOpen(true)}
              actionLabel="New Team"
            />
          )}
          </PageContent>
          <CreateTeamModal
            open={createModalOpen}
            onOpenChange={setCreateModalOpen}
            onCreateTeam={handleCreateTeam}
          />
        </>
      )}

      {viewMode === 'detail' && selectedTeam && (
        <TeamDetail
          team={selectedTeam}
          onBack={handleBack}
          onUpdateTeam={updateTeam}
          onDeleteTeam={handleDeleteTeam}
          onInviteMember={handleInviteMember}
          onUpdateMemberRole={handleUpdateMemberRole}
          onRemoveMember={handleRemoveMember}
          onUploadTeamImage={handleUploadTeamImage}
          onViewTasks={handleViewTasks}
        />
      )}

      {viewMode === 'tasks' && selectedTeam && (
        <div className="h-full flex flex-col">
          <PageHeader
            title={`${selectedTeam.name} - Tasks`}
            description="Drag and drop tasks to change status"
          />
          <PageContent className="flex-1 overflow-hidden">
            <TaskBoard
              tasksByStatus={tasksByStatus()}
              statuses={teamStatuses}
              teamId={selectedTeam.id}
              teamMembers={selectedTeam.members || []}
              canManageStatuses={
                selectedTeam.members?.some(
                  (m) =>
                    m.userId === session?.user?.id &&
                    (m.role === 'OWNER' || m.role === 'ADMIN')
                ) ?? false
              }
              onCreateTask={createTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onAssignTask={assignTask}
              onUnassignTask={unassignTask}
              onReorderTasks={reorderTasks}
              onStatusesChange={() => {
                refetchStatuses();
                fetchTasks();
              }}
            />
          </PageContent>
        </div>
      )}
    </PageLayout>
  );
}
