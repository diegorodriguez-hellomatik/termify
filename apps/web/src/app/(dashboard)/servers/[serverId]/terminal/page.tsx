'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Server, Terminal as TerminalIcon, X } from 'lucide-react';
import { serversApi, terminalsApi, Server as ServerType } from '@/lib/api';
import { Terminal } from '@/components/terminal/Terminal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { TerminalStatus } from '@termify/shared';

export default function EphemeralTerminalPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();

  const serverId = params.serverId as string;

  const [server, setServer] = useState<ServerType | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Track if we've created a terminal to clean up on unmount
  const createdTerminalId = useRef<string | null>(null);
  // Store token in ref so cleanup doesn't get stale closure
  const tokenRef = useRef<string | null>(null);

  // Keep token ref updated
  useEffect(() => {
    tokenRef.current = session?.accessToken || null;
  }, [session?.accessToken]);

  // Load server info
  useEffect(() => {
    const loadServer = async () => {
      if (!session?.accessToken) return;

      try {
        const response = await serversApi.get(serverId, session.accessToken);
        if (response.success && response.data) {
          setServer(response.data);

          // Check if we need credentials
          if (!response.data.isDefault && response.data.authMethod !== 'AGENT') {
            setNeedsCredentials(true);
            setLoading(false);
          } else {
            // For localhost or AGENT auth, connect directly
            await connectToServer(response.data);
          }
        } else {
          setError('Server not found');
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to load server');
        setLoading(false);
      }
    };

    if (sessionStatus === 'authenticated') {
      loadServer();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [serverId, session?.accessToken, sessionStatus]);

  // Connect to server and create ephemeral terminal
  const connectToServer = async (serverData: ServerType, credentials?: { password?: string; privateKey?: string }) => {
    if (!session?.accessToken) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await serversApi.connect(
        serverData.id,
        credentials || {},
        session.accessToken
      );

      if (response.success && response.data) {
        const newTerminalId = response.data.terminal.id;
        setTerminalId(newTerminalId);
        createdTerminalId.current = newTerminalId;
        setNeedsCredentials(false);
      } else {
        setError(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to connect to server'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setConnecting(false);
      setLoading(false);
    }
  };

  // Handle connect with credentials
  const handleConnect = () => {
    if (!server) return;

    const credentials: { password?: string; privateKey?: string } = {};
    if (server.authMethod === 'PASSWORD') {
      credentials.password = password;
    } else if (server.authMethod === 'KEY') {
      credentials.privateKey = privateKey;
    }

    connectToServer(server, credentials);
  };

  // Delete terminal function using API client
  const deleteTerminal = useCallback(async () => {
    if (createdTerminalId.current && tokenRef.current) {
      const id = createdTerminalId.current;
      const token = tokenRef.current;
      createdTerminalId.current = null; // Clear immediately to prevent double delete
      try {
        await terminalsApi.delete(id, token);
      } catch (e) {
        // Ignore errors on cleanup
      }
    }
  }, []);

  // Cleanup: delete the ephemeral terminal when leaving the page
  useEffect(() => {
    // Handle page close/refresh
    const handleBeforeUnload = () => {
      deleteTerminal();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteTerminal();
    };
  }, [deleteTerminal]);

  // Handle back button - ensure cleanup happens
  const handleBack = useCallback(() => {
    if (createdTerminalId.current && tokenRef.current) {
      terminalsApi.delete(createdTerminalId.current, tokenRef.current).then(() => {
        createdTerminalId.current = null;
        router.push('/servers');
      }).catch(() => {
        createdTerminalId.current = null;
        router.push('/servers');
      });
    } else {
      router.push('/servers');
    }
  }, [router]);

  const handleTerminalReady = useCallback(() => {
    setIsReady(true);
  }, []);

  if (sessionStatus === 'loading' || (loading && !needsCredentials)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (error && !needsCredentials) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <X size={32} className="text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
        <p className="text-muted-foreground mb-4 text-center max-w-md">{error}</p>
        <Link href="/servers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Servers
          </Button>
        </Link>
      </div>
    );
  }

  // Credentials form
  if (needsCredentials && server) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div
          className="w-full max-w-md rounded-xl shadow-lg overflow-hidden"
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
            >
              <Server size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold">{server.name}</h2>
              <p className="text-sm text-muted-foreground">
                {server.host}:{server.port}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter credentials to connect to this server
            </p>

            {server.authMethod === 'PASSWORD' ? (
              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) {
                      handleConnect();
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">Private Key</label>
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono resize-none"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <X size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={
                  connecting ||
                  (server.authMethod === 'PASSWORD' && !password) ||
                  (server.authMethod === 'KEY' && !privateKey)
                }
                className="flex-1"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Terminal view
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isDark ? 'bg-primary/20' : 'bg-primary/10'
              )}
            >
              {server?.isDefault ? (
                <TerminalIcon size={16} className="text-primary" />
              ) : (
                <Server size={16} className="text-orange-500" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{server?.name || 'Terminal'}</h1>
              {server && !server.isDefault && (
                <p className="text-xs text-muted-foreground">
                  {server.username}@{server.host}:{server.port}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Ephemeral Session
          </span>
        </div>
      </div>

      {/* Terminal - header ~52px */}
      {terminalId && session?.accessToken && (
        <div
          className="relative w-full"
          style={{ height: 'calc(100vh - 52px)' }}
        >
          {/* Loading overlay */}
          {!isReady && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center"
              style={{ backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5' }}
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
                      className="text-primary"
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
                    Starting terminal
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: isDark ? '#888' : '#666' }}
                  >
                    Connecting to {server?.name || 'server'}...
                  </p>
                </div>
              </div>
            </div>
          )}

          <Terminal
            terminalId={terminalId}
            token={session.accessToken}
            className="absolute inset-0"
            isActive={true}
            onReady={handleTerminalReady}
            hideToolbar={false}
          />
        </div>
      )}
    </div>
  );
}
