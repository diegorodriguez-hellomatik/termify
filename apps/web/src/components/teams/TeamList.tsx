'use client';

import {
  Users,
  ChevronRight,
  ListTodo,
  Crown,
  Shield,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Team, TeamRole } from '@/lib/api';

type CardViewMode = 'grid' | 'compact' | 'list';

interface TeamListProps {
  teams: Team[];
  loading: boolean;
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  viewMode?: CardViewMode;
}

const ROLE_ICONS: Record<TeamRole, React.FC<{ className?: string }>> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
};

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

function TeamCard({
  team,
  selected,
  onSelect,
  viewMode = 'grid',
}: {
  team: Team;
  selected: boolean;
  onSelect: () => void;
  viewMode?: CardViewMode;
}) {
  const RoleIcon = ROLE_ICONS[team.role];

  // List view - horizontal layout
  if (viewMode === 'list') {
    return (
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md',
          selected && 'border-primary ring-1 ring-primary'
        )}
        onClick={onSelect}
      >
        <div className="flex items-center gap-4 p-3">
          {/* Color indicator */}
          <div
            className="w-1 h-10 rounded-full flex-shrink-0"
            style={{ backgroundColor: team.color || '#6366f1' }}
          />
          {/* Icon/Image */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: team.image ? undefined : (team.color || '#6366f1') }}
          >
            {team.image ? (
              <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              team.icon || team.name.charAt(0).toUpperCase()
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{team.name}</h3>
            </div>
            {team.description && (
              <p className="text-sm text-muted-foreground truncate">{team.description}</p>
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{team.memberCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <ListTodo className="h-3.5 w-3.5" />
              <span>{team.taskCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <RoleIcon className="h-3.5 w-3.5" />
              <span>{ROLE_LABELS[team.role]}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </Card>
    );
  }

  // Compact view - smaller cards
  if (viewMode === 'compact') {
    return (
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md',
          selected && 'border-primary ring-1 ring-primary'
        )}
        onClick={onSelect}
      >
        {/* Color bar */}
        <div
          className="h-1.5 rounded-t-lg"
          style={{ backgroundColor: team.color || '#6366f1' }}
        />
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: team.image ? undefined : (team.color || '#6366f1') }}
              >
                {team.image ? (
                  <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                  team.icon || team.name.charAt(0).toUpperCase()
                )}
              </div>
              <h3 className="font-medium text-sm text-foreground truncate">{team.name}</h3>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{team.memberCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <ListTodo className="h-3 w-3" />
                <span>{team.taskCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <RoleIcon className="h-3 w-3" />
              <span>{ROLE_LABELS[team.role]}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Default grid view
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md',
        selected && 'border-primary ring-1 ring-primary'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-semibold overflow-hidden"
              style={{ backgroundColor: team.image ? undefined : (team.color || '#6366f1') }}
            >
              {team.image ? (
                <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
              ) : (
                team.icon || team.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <CardTitle className="text-base">{team.name}</CardTitle>
              {team.description && (
                <CardDescription className="text-xs mt-0.5 line-clamp-1">
                  {team.description}
                </CardDescription>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{team.memberCount} members</span>
            </div>
            <div className="flex items-center gap-1">
              <ListTodo className="h-3.5 w-3.5" />
              <span>{team.taskCount} tasks</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <RoleIcon className="h-3.5 w-3.5" />
            <span>{ROLE_LABELS[team.role]}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamList({
  teams,
  loading,
  selectedTeamId,
  onSelectTeam,
  viewMode = 'grid',
}: TeamListProps) {
  if (loading) {
    return (
      <div
        key={`team-grid-loading-${viewMode}`}
        className={cn(
          'gap-3',
          viewMode === 'list'
            ? 'flex flex-col'
            : viewMode === 'compact'
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          'animate-in fade-in duration-200'
        )}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded mt-2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-3 w-40 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No teams yet</h3>
        <p className="text-sm text-muted-foreground text-center">
          Create a team to collaborate with others on tasks and terminals.
        </p>
      </div>
    );
  }

  return (
    <div
      key={`team-grid-${viewMode}`}
      className={cn(
        'gap-3',
        viewMode === 'list'
          ? 'flex flex-col'
          : viewMode === 'compact'
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        'animate-in fade-in duration-200'
      )}>
      {teams.map((team, index) => (
        <div
          key={team.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: 'both' }}
        >
          <TeamCard
            team={team}
            selected={selectedTeamId === team.id}
            onSelect={() => onSelectTeam(team.id)}
            viewMode={viewMode}
          />
        </div>
      ))}
    </div>
  );
}
