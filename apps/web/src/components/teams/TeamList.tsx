'use client';

import {
  Users,
  ListTodo,
  Crown,
  Shield,
  User,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { Team, TeamRole } from '@/lib/api';

type CardViewMode = 'grid' | 'compact' | 'list';

interface TeamListProps {
  teams: Team[];
  loading: boolean;
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  viewMode?: CardViewMode;
}

const ROLE_ICONS: Record<TeamRole, React.FC<{ className?: string; size?: number }>> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
};

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  OWNER: '#f59e0b',
  ADMIN: '#8b5cf6',
  MEMBER: '#6b7280',
};

function TeamCard({
  team,
  selected,
  onSelect,
  viewMode = 'grid',
  isDark,
}: {
  team: Team;
  selected: boolean;
  onSelect: () => void;
  viewMode?: CardViewMode;
  isDark: boolean;
}) {
  const RoleIcon = ROLE_ICONS[team.role];
  const teamColor = team.color || '#6366f1';

  // List view - horizontal layout
  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'group relative rounded-lg border cursor-pointer',
          'hover:shadow-md transition-all duration-200',
          isDark
            ? 'bg-card border-border hover:border-muted-foreground/30'
            : 'bg-white border-gray-200 hover:border-gray-300',
          selected && 'border-primary ring-1 ring-primary'
        )}
        onClick={onSelect}
      >
        <div className="flex items-center gap-4 p-3">
          {/* Color indicator */}
          <div
            className="w-1 h-10 rounded-full flex-shrink-0"
            style={{ backgroundColor: teamColor }}
          />
          {/* Icon/Image */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: team.image ? undefined : teamColor }}
          >
            {team.image ? (
              <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-lg font-semibold">
                {team.icon || team.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{team.name}</h3>
            {team.description ? (
              <p className="text-sm text-muted-foreground truncate">{team.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic truncate">No description</p>
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span>{team.memberCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ListTodo size={14} />
              <span>{team.taskCount}</span>
            </div>
          </div>
          {/* Role badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
            style={{
              backgroundColor: ROLE_COLORS[team.role] + '20',
              color: ROLE_COLORS[team.role],
            }}
          >
            <RoleIcon size={12} />
            <span>{ROLE_LABELS[team.role]}</span>
          </div>
          {/* Actions */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md hover:bg-muted transition-all"
            >
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact view - smaller cards
  if (viewMode === 'compact') {
    return (
      <div
        className={cn(
          'group relative rounded-lg border cursor-pointer',
          'hover:shadow-md transition-all duration-200',
          isDark
            ? 'bg-card border-border hover:border-muted-foreground/30'
            : 'bg-white border-gray-200 hover:border-gray-300',
          selected && 'border-primary ring-1 ring-primary'
        )}
        onClick={onSelect}
      >
        {/* Color bar */}
        <div
          className="h-1.5 rounded-t-lg"
          style={{ backgroundColor: teamColor }}
        />
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: team.image ? undefined : teamColor }}
              >
                {team.image ? (
                  <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-semibold">
                    {team.icon || team.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="font-medium text-sm text-foreground truncate">{team.name}</h3>
            </div>
            {/* Role badge */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: ROLE_COLORS[team.role] + '20',
                color: ROLE_COLORS[team.role],
              }}
            >
              <RoleIcon size={10} />
              <span>{ROLE_LABELS[team.role]}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{team.memberCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <ListTodo size={12} />
              <span>{team.taskCount}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default grid view - Modern card design matching workspaces
  return (
    <div
      className={cn(
        'group relative rounded-xl border cursor-pointer flex flex-col',
        'hover:shadow-lg transition-all duration-200',
        isDark
          ? 'bg-card border-border hover:border-muted-foreground/30'
          : 'bg-white border-gray-200 hover:border-gray-300',
        selected && 'border-primary ring-1 ring-primary'
      )}
      onClick={onSelect}
    >
      {/* Color bar */}
      <div
        className="h-2 rounded-t-xl flex-shrink-0"
        style={{ backgroundColor: teamColor }}
      />

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: team.image ? undefined : teamColor }}
            >
              {team.image ? (
                <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xl font-semibold">
                  {team.icon || team.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{team.name}</h3>
              {/* Role badge */}
              <div
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium mt-0.5"
                style={{
                  backgroundColor: ROLE_COLORS[team.role] + '20',
                  color: ROLE_COLORS[team.role],
                }}
              >
                <RoleIcon size={10} />
                <span>{ROLE_LABELS[team.role]}</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md hover:bg-muted transition-all"
            >
              <MoreHorizontal size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Description - with min height to maintain card size */}
        <div className="flex-1 min-h-[40px] mb-4">
          {team.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {team.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              No description
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Users size={14} />
            <span>{team.memberCount} members</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ListTodo size={14} />
            <span>{team.taskCount} tasks</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamList({
  teams,
  loading,
  selectedTeamId,
  onSelectTeam,
  viewMode = 'grid',
}: TeamListProps) {
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div
        key={`team-grid-loading-${viewMode}`}
        className={cn(
          'gap-4',
          viewMode === 'list'
            ? 'flex flex-col'
            : viewMode === 'compact'
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          'animate-in fade-in duration-200'
        )}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border animate-pulse',
              isDark ? 'bg-card border-border' : 'bg-white border-gray-200'
            )}
          >
            {/* Color bar skeleton */}
            <div className="h-2 rounded-t-xl bg-muted" />
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              </div>
              <div className="h-4 w-full bg-muted rounded mb-4" />
              <div className="pt-3 border-t border-border">
                <div className="h-4 w-40 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
          }}
        >
          <Users size={40} className="text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No teams yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Create a team to collaborate with others on tasks and terminals.
        </p>
      </div>
    );
  }

  return (
    <div
      key={`team-grid-${viewMode}`}
      className={cn(
        'gap-4',
        viewMode === 'list'
          ? 'flex flex-col'
          : viewMode === 'compact'
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
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
            isDark={isDark}
          />
        </div>
      ))}
    </div>
  );
}
