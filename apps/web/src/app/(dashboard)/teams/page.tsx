'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, LayoutGrid, Grid3x3, List } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { BlankAreaContextMenu } from '@/components/ui/BlankAreaContextMenu';
import { useTeams } from '@/hooks/useTeams';
import { useTheme } from '@/context/ThemeContext';
import { TeamList, CreateTeamModal, EditTeamModal } from '@/components/teams';
import { MobileTeamList } from '@/components/mobile';
import { Team, teamsApi } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
  const { isDark } = useTheme();
  const { data: session } = useSession();

  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('grid');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { teams, loading: teamsLoading, createTeam, updateTeam } = useTeams();

  const handleSelectTeam = (teamId: string) => {
    router.push(`/teams/${teamId}`);
  };

  const handleCreateTeam = async (
    data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    },
    avatarFile?: File | null
  ) => {
    const team = await createTeam(data);
    if (team) {
      // Upload avatar if provided
      if (avatarFile && session?.accessToken) {
        try {
          await teamsApi.uploadImage(team.id, avatarFile, session.accessToken);
        } catch (err) {
          console.error('Failed to upload team avatar:', err);
        }
      }
      router.push(`/teams/${team.id}`);
    }
    return team;
  };

  const handleEditTeam = (team: Team) => {
    setTeamToEdit(team);
    setEditModalOpen(true);
  };

  const handleUpdateTeam = async (
    teamId: string,
    data: { name?: string; description?: string; color?: string; icon?: string },
    avatarFile?: File | null
  ) => {
    const team = await updateTeam(teamId, data);
    if (team && avatarFile && session?.accessToken) {
      try {
        await teamsApi.uploadImage(teamId, avatarFile, session.accessToken);
      } catch (err) {
        console.error('Failed to upload team avatar:', err);
      }
    }
    return team;
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
    <>
      {/* Mobile View */}
      <div className="md:hidden h-full">
        <MobileTeamList
          teams={filteredTeams}
          onTeamClick={(team) => handleSelectTeam(team.id)}
          onCreateTeam={() => setCreateModalOpen(true)}
          isLoading={teamsLoading}
        />
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <PageLayout>
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
                selectedTeamId={null}
                onSelectTeam={handleSelectTeam}
                onEditTeam={handleEditTeam}
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
        </PageLayout>
      </div>

      {/* Modals - Available on both mobile and desktop */}
      <CreateTeamModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreateTeam={handleCreateTeam}
      />
      <EditTeamModal
        team={teamToEdit}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onUpdateTeam={handleUpdateTeam}
      />
    </>
  );
}
