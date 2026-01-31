'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Users,
  Settings,
  ChevronLeft,
  Loader2,
  Activity,
  FolderOpen,
  History,
  Camera,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTeams } from '@/hooks/useTeams';
import { useTeamSocket } from '@/hooks/useTeamSocket';
import { useTeamChat } from '@/hooks/useTeamChat';
import { TeamChatPanel } from '@/components/chat';
import { TeamChatBubble } from '@/components/chat/TeamChatBubble';
import { Team } from '@/lib/api';

interface TeamLayoutProps {
  children: React.ReactNode;
}

type TabType = 'overview' | 'resources' | 'members' | 'activity' | 'settings';

export default function TeamLayout({ children }: TeamLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const { getTeam } = useTeams();

  // Team chat - always enabled so messages keep loading while navigating
  const {
    messages: chatMessages,
    onlineMembers: chatOnlineMembers,
    isLoading: chatLoading,
    isConnected: chatConnected,
    sendMessage: sendChatMessage,
  } = useTeamChat({
    token: accessToken ?? null,
    teamId,
    enabled: true,
  });

  // Determine active tab from pathname
  const getActiveTab = (): TabType => {
    if (pathname?.includes('/members')) return 'members';
    if (pathname?.includes('/activity')) return 'activity';
    if (pathname?.includes('/settings')) return 'settings';
    if (
      pathname?.includes('/workspaces') ||
      pathname?.includes('/terminals') ||
      pathname?.includes('/snippets') ||
      pathname?.includes('/servers') ||
      pathname?.includes('/tasks')
    ) {
      return 'resources';
    }
    return 'overview';
  };

  const activeTab = getActiveTab();

  // Load team details
  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const teamData = await getTeam(teamId);
      if (teamData) {
        setTeam(teamData);
      } else {
        router.push('/teams');
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, getTeam, router]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // Listen for team-updated events from settings page
  useEffect(() => {
    const handleTeamUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ teamId: string }>;
      if (customEvent.detail.teamId === teamId) {
        loadTeam();
      }
    };

    window.addEventListener('team-updated', handleTeamUpdated);
    return () => window.removeEventListener('team-updated', handleTeamUpdated);
  }, [teamId, loadTeam]);

  // WebSocket for real-time updates
  useTeamSocket({
    token: accessToken || null,
    teamId,
    callbacks: {
      onMemberJoined: () => loadTeam(),
      onMemberLeft: () => loadTeam(),
      onMemberRoleChanged: () => loadTeam(),
    },
  });

  const canEdit = team?.role === 'OWNER' || team?.role === 'ADMIN';

  const handleTabClick = (tab: TabType) => {
    switch (tab) {
      case 'overview':
        router.push(`/teams/${teamId}`);
        break;
      case 'resources':
        router.push(`/teams/${teamId}/terminals`);
        break;
      case 'members':
        router.push(`/teams/${teamId}/members`);
        break;
      case 'activity':
        router.push(`/teams/${teamId}/activity`);
        break;
      case 'settings':
        router.push(`/teams/${teamId}/settings`);
        break;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Team not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/teams')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold overflow-hidden"
            style={{ backgroundColor: team.image ? undefined : (team.color || '#6366f1') }}
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
            <Button variant="outline" size="sm" onClick={() => router.push(`/teams/${teamId}/settings`)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-4">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => handleTabClick('overview')}
          icon={<Activity className="h-4 w-4" />}
        >
          Overview
        </TabButton>
        <TabButton
          active={activeTab === 'resources'}
          onClick={() => handleTabClick('resources')}
          icon={<FolderOpen className="h-4 w-4" />}
        >
          Resources
        </TabButton>
        <TabButton
          active={activeTab === 'members'}
          onClick={() => handleTabClick('members')}
          icon={<Users className="h-4 w-4" />}
        >
          Members
        </TabButton>
        <TabButton
          active={activeTab === 'activity'}
          onClick={() => handleTabClick('activity')}
          icon={<History className="h-4 w-4" />}
        >
          Activity
        </TabButton>
        {canEdit && (
          <TabButton
            active={activeTab === 'settings'}
            onClick={() => handleTabClick('settings')}
            icon={<Settings className="h-4 w-4" />}
          >
            Settings
          </TabButton>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* Floating Chat Bubble */}
      <TeamChatBubble
        isOpen={chatOpen}
        onClick={() => setChatOpen(!chatOpen)}
        unreadCount={0}
        onlineCount={chatOnlineMembers.length}
      />

      {/* Team Chat Panel */}
      <TeamChatPanel
        messages={chatMessages}
        onlineMembers={chatOnlineMembers}
        currentUserId={session?.user?.id || ''}
        isLoading={chatLoading}
        isConnected={chatConnected}
        onSendMessage={sendChatMessage}
        onClose={() => setChatOpen(false)}
        isOpen={chatOpen}
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
