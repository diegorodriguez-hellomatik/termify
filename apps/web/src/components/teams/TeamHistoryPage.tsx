'use client';

import { useState } from 'react';
import { History, Search, Terminal, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTeamHistory } from '@/hooks/useTeamHistory';

interface TeamHistoryPageProps {
  teamId: string;
}

export function TeamHistoryPage({ teamId }: TeamHistoryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { history, loading, error, refetch } = useTeamHistory(teamId);

  const filteredHistory = searchQuery
    ? history.filter((item) =>
        item.command.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading && history.length === 0) {
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
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No command history</h3>
          <p className="text-sm text-muted-foreground text-center">
            Commands executed in team terminals will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium"
              >
                {item.user?.name?.charAt(0).toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{item.user?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatTime(item.createdAt)}
                  </span>
                </div>
                <code className="block font-mono text-sm bg-muted px-2 py-1 rounded truncate">
                  {item.command}
                </code>
              </div>

              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Terminal className="h-3 w-3" />
                  <span>Terminal</span>
                </div>
                {item.exitCode !== null && (
                  <span
                    className={
                      item.exitCode === 0 ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    Exit: {item.exitCode}
                  </span>
                )}
                {item.duration !== null && (
                  <span>{formatDuration(item.duration)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
