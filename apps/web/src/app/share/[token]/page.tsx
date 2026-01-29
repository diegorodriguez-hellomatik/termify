'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Terminal as TerminalIcon,
  ArrowLeft,
  Eye,
  Edit3,
  User,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { shareApi, SharePermission } from '@/lib/api';
import { Terminal } from '@/components/terminal/Terminal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface SharedTerminalData {
  share: {
    id: string;
    permission: SharePermission;
    type: string;
  };
  terminal: {
    id: string;
    name: string;
    status: string;
    cols: number;
    rows: number;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
    category?: {
      id: string;
      name: string;
      color: string;
      icon?: string;
    } | null;
  };
  isAuthenticated: boolean;
}

export default function SharedTerminalPage() {
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const [data, setData] = useState<SharedTerminalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    const loadSharedTerminal = async () => {
      try {
        const response = await shareApi.accessByToken(token, session?.accessToken);
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.error?.toString() || 'Failed to load shared terminal');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared terminal');
      } finally {
        setLoading(false);
      }
    };

    // Wait for session to be determined before loading
    if (sessionStatus !== 'loading') {
      loadSharedTerminal();
    }
  }, [token, session?.accessToken, sessionStatus]);

  // Fallback timeout to show terminal
  useEffect(() => {
    if (data && !isReady) {
      const timeout = setTimeout(() => setIsReady(true), 3000);
      return () => clearTimeout(timeout);
    }
  }, [data, isReady]);

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading shared terminal...</p>
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

  const { share, terminal } = data;
  const canControl = share.permission === 'CONTROL';

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
                  color: terminal.category?.color || (isDark ? '#888' : '#666'),
                }}
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{terminal.name}</h1>
              <p className="text-xs text-muted-foreground">
                {terminal.cols}x{terminal.rows}
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
              {terminal.user.image ? (
                <img
                  src={terminal.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User size={16} className="text-muted-foreground" />
              )}
            </div>
            <div className="text-sm">
              <p className="font-medium">{terminal.user.name || terminal.user.email}</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Loading overlay */}
        {!isReady && (
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
                  Connecting to shared terminal
                </h3>
                <p className="text-sm" style={{ color: isDark ? '#888' : '#666' }}>
                  {canControl ? 'You have control access' : 'View-only access'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Terminal - use shareToken for WebSocket auth, session token is optional */}
        <Terminal
          terminalId={terminal.id}
          token={session?.accessToken || ''}
          shareToken={token}
          readOnly={!canControl}
          className="absolute inset-0"
          isActive={true}
          onReady={() => setIsReady(true)}
        />
      </div>
    </div>
  );
}
