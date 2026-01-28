'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Edit2, Terminal as TerminalIcon, Loader2 } from 'lucide-react';
import { TerminalStatus } from '@claude-terminal/shared';
import { terminalsApi } from '@/lib/api';
import { Terminal } from '@/components/terminal/Terminal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';

interface TerminalData {
  id: string;
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  cwd: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const [terminal, setTerminal] = useState<TerminalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [terminalReady, setTerminalReady] = useState(false);

  const terminalId = params.id as string;

  useEffect(() => {
    const loadTerminal = async () => {
      if (!session?.accessToken) return;

      try {
        const response = await terminalsApi.get(terminalId, session.accessToken);
        if (response.success && response.data) {
          setTerminal(response.data);
          setNewName(response.data.name);
        } else {
          setError('Terminal not found');
        }
      } catch (err) {
        setError('Failed to load terminal');
      } finally {
        setLoading(false);
      }
    };

    if (sessionStatus === 'authenticated') {
      loadTerminal();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [terminalId, session?.accessToken, sessionStatus, router]);

  const handleUpdateName = async () => {
    if (!session?.accessToken || !terminal) return;

    try {
      const response = await terminalsApi.update(
        terminal.id,
        { name: newName },
        session.accessToken
      );
      if (response.success && response.data) {
        setTerminal({ ...terminal, name: newName });
        setEditingName(false);
      }
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !terminal) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold mb-2">
          {error || 'Terminal not found'}
        </h2>
        <p className="text-muted-foreground mb-4">
          The terminal you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Link href="/terminals">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Terminals
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/terminals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 w-48"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateName();
                  if (e.key === 'Escape') {
                    setEditingName(false);
                    setNewName(terminal.name);
                  }
                }}
                autoFocus
              />
              <Button size="sm" onClick={handleUpdateName}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingName(false);
                  setNewName(terminal.name);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{terminal.name}</h1>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 hover:bg-muted rounded"
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {terminal.cols}x{terminal.rows}
          </span>
          {terminal.cwd && (
            <>
              <span className="mx-2">|</span>
              <span>{terminal.cwd}</span>
            </>
          )}
        </div>
      </div>

      {/* Terminal */}
      {session?.accessToken && (
        <div className="flex-1 min-h-0 relative">
          {/* Loading Overlay */}
          {!terminalReady && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center"
              style={{
                backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5',
              }}
            >
              <div className="flex flex-col items-center gap-6">
                {/* Animated Terminal Icon */}
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
                      className="text-primary"
                      style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
                    />
                  </div>
                  {/* Spinner around icon */}
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

                {/* Text */}
                <div className="text-center">
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    Starting Terminal
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: isDark ? '#888' : '#666' }}
                  >
                    Connecting to your session...
                  </p>
                </div>

                {/* Animated dots */}
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{
                        backgroundColor: isDark ? '#60a5fa' : '#2563eb',
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <Terminal
            terminalId={terminal.id}
            token={session.accessToken}
            initialStatus={terminal.status}
            className="h-full"
            onReady={() => setTerminalReady(true)}
          />
        </div>
      )}
    </div>
  );
}
