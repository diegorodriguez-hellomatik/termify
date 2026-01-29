'use client';

import { Users, Terminal, CheckSquare, Activity, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTeamPresence } from '@/hooks/useTeamPresence';

interface TeamDashboardProps {
  teamId: string;
}

export function TeamDashboard({ teamId }: TeamDashboardProps) {
  const { presence, stats, loading, error, onlineCount } = useTeamPresence(teamId);

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
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Now</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineCount}</div>
            <p className="text-xs text-muted-foreground">
              of {stats?.memberCount || 0} members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Terminals</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeTerminals || 0}</div>
            <p className="text-xs text-muted-foreground">running now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeTasks || 0}</div>
            <p className="text-xs text-muted-foreground">in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commands (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.commandsLast24h || 0}</div>
            <p className="text-xs text-muted-foreground">executed</p>
          </CardContent>
        </Card>
      </div>

      {/* Online Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Online Members</CardTitle>
        </CardHeader>
        <CardContent>
          {presence.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No members online right now
            </p>
          ) : (
            <div className="space-y-4">
              {presence.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {member.userName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                          member.status
                        )}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium">{member.userName}</p>
                      {member.activeTerminalId && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Terminal className="h-3 w-3" />
                          Working on a terminal
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted capitalize">
                      {member.status}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatLastActivity(member.lastActivityAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatLastActivity(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
