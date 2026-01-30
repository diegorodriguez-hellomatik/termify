'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  LayoutGrid,
  ArrowLeft,
  Eye,
  Edit3,
  User,
  AlertCircle,
  Lock,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { workspaceShareApi, SharePermission } from '@/lib/api';
import { Terminal } from '@/components/terminal/Terminal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface SharedWorkspaceData {
  share: {
    id: string;
    permission: SharePermission;
    type: string;
  };
  workspace: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    layout: any | null;
    floatingLayout: any | null;
    settings: any | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
    terminals: Array<{
      id: string;
      name: string;
      status: string;
      type: string;
      cols: number;
      rows: number;
      cwd: string | null;
      isFavorite: boolean;
      lastActiveAt: string | null;
      position: number;
    }>;
    terminalCount: number;
  };
  isAuthenticated: boolean;
}

export default function SharedWorkspacePage() {
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const [data, setData] = useState<SharedWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    const loadSharedWorkspace = async () => {
      try {
        const response = await workspaceShareApi.accessByToken(token, session?.accessToken);
        if (response.success && response.data) {
          setData(response.data);
          // Set first terminal as active
          if (response.data.workspace.terminals.length > 0) {
            setActiveTerminalId(response.data.workspace.terminals[0].id);
          }
        } else {
          setError(response.error?.toString() || 'Failed to load shared workspace');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared workspace');
      } finally {
        setLoading(false);
      }
    };

    // Wait for session to be determined before loading
    if (sessionStatus !== 'loading') {
      loadSharedWorkspace();
    }
  }, [token, session?.accessToken, sessionStatus]);

  // Fallback timeout to show content
  useEffect(() => {
    if (data && !isReady) {
      const timeout = setTimeout(() => setIsReady(true), 2000);
      return () => clearTimeout(timeout);
    }
  }, [data, isReady]);

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading shared workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
            border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
          }}
        >
          {error?.includes('expired') ? (
            <Lock size={40} className="text-muted-foreground" />
          ) : (
            <AlertCircle size={40} className="text-destructive" />
          )}
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {error?.includes('expired') ? 'Link Expired' : 'Access Denied'}
        </h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          {error || 'This share link is invalid or has expired.'}
        </p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </Link>
      </div>
    );
  }

  const { share, workspace } = data;
  const canControl = share.permission === 'CONTROL';
  const activeTerminal = workspace.terminals.find((t) => t.id === activeTerminalId);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: workspace.color
                  ? `${workspace.color}20`
                  : isDark
                  ? '#333'
                  : '#f0f0f0',
              }}
            >
              <LayoutGrid
                size={20}
                style={{
                  color: workspace.color || (isDark ? '#888' : '#666'),
                }}
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{workspace.name}</h1>
              <p className="text-xs text-muted-foreground">
                {workspace.terminalCount} terminal{workspace.terminalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Permission badge */}
          <span
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
              canControl
                ? 'bg-green-500/10 text-green-500'
                : 'bg-blue-500/10 text-blue-500'
            )}
          >
            {canControl ? (
              <>
                <Edit3 size={14} />
                Control
              </>
            ) : (
              <>
                <Eye size={14} />
                View Only
              </>
            )}
          </span>

          {/* Owner info */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: isDark ? '#333' : '#e0e0e0',
              }}
            >
              {workspace.user.image ? (
                <img
                  src={workspace.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User size={16} className="text-muted-foreground" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-medium">{workspace.user.name || workspace.user.email}</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Terminal Sidebar */}
        <div
          className="w-64 border-r border-border flex flex-col"
          style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}
        >
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground">Terminals</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {workspace.terminals.map((terminal) => (
              <button
                key={terminal.id}
                onClick={() => setActiveTerminalId(terminal.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                  activeTerminalId === terminal.id
                    ? 'bg-primary/10 border border-primary/20'
                    : isDark
                    ? 'hover:bg-white/5'
                    : 'hover:bg-black/5'
                )}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: isDark ? '#262626' : '#e5e5e5',
                  }}
                >
                  <TerminalIcon
                    size={14}
                    className={
                      activeTerminalId === terminal.id
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      activeTerminalId === terminal.id
                        ? 'text-primary'
                        : ''
                    )}
                  >
                    {terminal.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {terminal.cols}x{terminal.rows}
                  </p>
                </div>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    terminal.status === 'RUNNING'
                      ? 'bg-green-500'
                      : terminal.status === 'STARTING'
                      ? 'bg-yellow-500'
                      : terminal.status === 'CRASHED'
                      ? 'bg-red-500'
                      : 'bg-gray-500'
                  )}
                />
              </button>
            ))}

            {workspace.terminals.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No terminals</p>
              </div>
            )}
          </div>
        </div>

        {/* Terminal View */}
        <div className="flex-1 relative">
          {/* Loading overlay */}
          {!isReady && activeTerminal && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center"
              style={{
                backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5',
              }}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                      border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                    }}
                  >
                    <TerminalIcon
                      size={40}
                      style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
                    />
                  </div>
                  <div className="absolute -inset-2">
                    <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={isDark ? '#333' : '#e0e0e0'}
                        strokeWidth="4"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={isDark ? '#60a5fa' : '#2563eb'}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="70 200"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    Connecting to terminal
                  </h3>
                  <p className="text-sm" style={{ color: isDark ? '#888' : '#666' }}>
                    {canControl ? 'You have control access' : 'View-only access'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Terminal */}
          {activeTerminal ? (
            <Terminal
              terminalId={activeTerminal.id}
              token={session?.accessToken || ''}
              shareToken={token}
              readOnly={!canControl}
              className="absolute inset-0"
              isActive={true}
              onReady={() => setIsReady(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <TerminalIcon
                  size={48}
                  className="mx-auto mb-4 text-muted-foreground"
                />
                <p className="text-muted-foreground">
                  Select a terminal from the sidebar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
