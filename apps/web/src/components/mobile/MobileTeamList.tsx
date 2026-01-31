'use client';

import { useState, useCallback } from 'react';
import { Users, Terminal, CheckSquare, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Team } from '@/lib/api';
import { MobileContentHeader } from './MobileContentHeader';

interface MobileTeamListProps {
  teams: Team[];
  onTeamClick?: (team: Team) => void;
  onCreateTeam?: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

function MobileTeamCard({
  team,
  onClick,
}: {
  team: Team;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3',
        'py-3 px-4',
        'bg-card',
        'active:bg-muted transition-colors',
        'touch-manipulation cursor-pointer'
      )}
    >
      {/* Team avatar */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${team.color || '#6366f1'}20` }}
      >
        <Users
          size={20}
          style={{ color: team.color || '#6366f1' }}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{team.name}</p>
        {team.description && (
          <p className="text-xs text-muted-foreground truncate">{team.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Members">
            <Users size={12} />
            {team.memberCount || 0}
          </span>
          <span className="flex items-center gap-1" title="Terminals">
            <Terminal size={12} />
            {team.terminalCount || 0}
          </span>
          <span className="flex items-center gap-1" title="Tasks">
            <CheckSquare size={12} />
            {team.taskCount || 0}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

export function MobileTeamList({
  teams,
  onTeamClick,
  onCreateTeam,
  onRefresh,
  isLoading = false,
}: MobileTeamListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="Teams"
        subtitle="Collaborate with your team"
        onCreateClick={onCreateTeam}
        onRefreshClick={handleRefresh}
        isRefreshing={isRefreshing}
        isLoading={isLoading}
      />

      {/* Team List */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          // Loading skeleton
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 px-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
                <div className="w-4 h-4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : teams.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
            <Users size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No teams yet</h3>
            <p className="text-muted-foreground text-sm">
              Create a team to start collaborating
            </p>
          </div>
        ) : (
          // Team cards
          <div className="divide-y divide-border">
            {teams.map((team) => (
              <MobileTeamCard
                key={team.id}
                team={team}
                onClick={() => onTeamClick?.(team)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
