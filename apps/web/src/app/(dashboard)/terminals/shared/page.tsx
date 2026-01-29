'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Users,
  Terminal as TerminalIcon,
  ExternalLink,
  Eye,
  Edit3,
  RefreshCw,
  ArrowLeft,
  User,
} from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { shareApi, SharedTerminal, SharePermission } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<string, string> = {
  STOPPED: 'bg-gray-500',
  STARTING: 'bg-yellow-500',
  RUNNING: 'bg-green-500',
  CRASHED: 'bg-red-500',
};

export default function SharedTerminalsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const [terminals, setTerminals] = useState<SharedTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSharedTerminals = async () => {
    if (!session?.accessToken) return;

    try {
      const response = await shareApi.getSharedWithMe(session.accessToken);
      if (response.success && response.data) {
        setTerminals(response.data.terminals);
        setError(null);
      } else {
        setError(response.error?.toString() || 'Failed to load shared terminals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared terminals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadSharedTerminals();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [session?.accessToken, sessionStatus, router]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSharedTerminals();
  };

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/terminals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Shared with Me
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Terminals that others have shared with you
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
            color: isDark ? '#f87171' : '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      {/* Empty State */}
      {terminals.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
              border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
            }}
          >
            <Users size={40} className="text-muted-foreground" />
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: isDark ? '#fff' : '#1a1a1a' }}
          >
            No Shared Terminals
          </h2>
          <p
            className="text-sm max-w-md"
            style={{ color: isDark ? '#888' : '#666' }}
          >
            When someone shares a terminal with you, it will appear here.
            Ask a team member to share their terminal with your email address.
          </p>
        </div>
      )}

      {/* Terminal Grid */}
      {terminals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {terminals.map((terminal) => (
            <Link
              key={terminal.id}
              href={`/terminals/${terminal.id}`}
              className={cn(
                'group block bg-card border border-border rounded-lg overflow-hidden',
                'transition-all duration-150 hover:border-primary/50 hover:shadow-lg'
              )}
            >
              <div className="p-4">
                {/* Terminal Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: terminal.category?.color
                          ? `${terminal.category.color}20`
                          : isDark
                          ? '#333'
                          : '#f0f0f0',
                      }}
                    >
                      <TerminalIcon
                        size={20}
                        style={{
                          color:
                            terminal.category?.color ||
                            (isDark ? '#888' : '#666'),
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{terminal.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {terminal.cols}x{terminal.rows}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Permission Badge */}
                    <span
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                        terminal.share.permission === 'CONTROL'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-blue-500/10 text-blue-500'
                      )}
                    >
                      {terminal.share.permission === 'CONTROL' ? (
                        <>
                          <Edit3 size={12} />
                          Control
                        </>
                      ) : (
                        <>
                          <Eye size={12} />
                          View
                        </>
                      )}
                    </span>

                    {/* Status Indicator */}
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        STATUS_COLORS[terminal.status] || 'bg-gray-500'
                      )}
                      title={terminal.status}
                    />
                  </div>
                </div>

                {/* Shared By */}
                <div
                  className="flex items-center gap-2 py-2 px-3 rounded-lg"
                  style={{
                    backgroundColor: isDark ? '#262626' : '#f5f5f5',
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isDark ? '#444' : '#ddd',
                    }}
                  >
                    {terminal.user.image ? (
                      <img
                        src={terminal.user.image}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <User
                        size={12}
                        className={isDark ? 'text-gray-400' : 'text-gray-600'}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: isDark ? '#ccc' : '#444' }}
                    >
                      {terminal.user.name || terminal.user.email}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Owner
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Shared {formatRelativeTime(new Date(terminal.share.createdAt))}
                  </span>
                  <ExternalLink
                    size={14}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
