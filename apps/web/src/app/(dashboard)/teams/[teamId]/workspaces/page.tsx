'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Terminal, Layout, Code2, Server, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeams } from '@/hooks/useTeams';
import { Team } from '@/lib/api';
import { TeamWorkspacesList } from '@/components/teams/TeamWorkspacesList';

export default function TeamWorkspacesPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const { getTeam } = useTeams();

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    const teamData = await getTeam(teamId);
    if (teamData) {
      setTeam(teamData);
    }
  }, [teamId, getTeam]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const canEdit = team?.role === 'OWNER' || team?.role === 'ADMIN';

  const handleOpenWorkspace = (workspaceId: string) => {
    router.push(`/workspace/${workspaceId}`);
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <ResourceSubNav teamId={teamId} activeTab="workspaces" />

      {/* Content */}
      <TeamWorkspacesList
        teamId={teamId}
        canManage={canEdit}
        onOpen={handleOpenWorkspace}
      />
    </div>
  );
}

// Resource Sub Navigation
function ResourceSubNav({ teamId, activeTab }: { teamId: string; activeTab: string }) {
  const router = useRouter();

  const tabs = [
    { id: 'terminals', label: 'Terminals', icon: Terminal, path: `/teams/${teamId}/terminals` },
    { id: 'workspaces', label: 'Workspaces', icon: Layout, path: `/teams/${teamId}/workspaces` },
    { id: 'snippets', label: 'Snippets', icon: Code2, path: `/teams/${teamId}/snippets` },
    { id: 'servers', label: 'Servers', icon: Server, path: `/teams/${teamId}/servers` },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, path: `/teams/${teamId}/tasks` },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
          )}
          onClick={() => router.push(tab.path)}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
