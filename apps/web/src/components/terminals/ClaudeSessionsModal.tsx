'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderOpen, MessageSquare, Clock, ChevronRight, Loader2, AlertCircle, Terminal, Server, Laptop, Eye, EyeOff, Key, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { claudeSessionsApi, terminalsApi, ClaudeProject, ClaudeSession } from '@/lib/api';

type SessionSource = 'local' | 'remote';
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error' | 'loading';

interface ClaudeSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionImported: (terminalId: string) => void;
  isDark: boolean;
  token?: string;
}

export function ClaudeSessionsModal({
  isOpen,
  onClose,
  onSessionImported,
  isDark,
  token,
}: ClaudeSessionsModalProps) {
  const [sessionSource, setSessionSource] = useState<SessionSource>('local');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ClaudeProject[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<{ projectPath: string; session: ClaudeSession } | null>(null);

  // Remote SSH state
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState('22');
  const [remoteUsername, setRemoteUsername] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [remotePrivateKey, setRemotePrivateKey] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  useEffect(() => {
    if (isOpen && token && sessionSource === 'local') {
      loadSessions();
    }
  }, [isOpen, token, sessionSource]);

  // Reset state when modal opens/closes or source changes
  useEffect(() => {
    if (!isOpen) {
      setSessionSource('local');
      setSelectedSession(null);
      setConnectionStatus('idle');
      setConnectionMessage('');
      setRemoteHost('');
      setRemotePort('22');
      setRemoteUsername('');
      setRemotePassword('');
      setRemotePrivateKey('');
    }
  }, [isOpen]);

  const loadSessions = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await claudeSessionsApi.list(token);

      if (response.success && response.data) {
        setProjects(response.data.projects);
        // Auto-expand first project
        if (response.data.projects.length > 0) {
          setExpandedProjects(new Set([response.data.projects[0].path]));
        }
      } else {
        setError(response.error?.toString() || 'Failed to load sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadRemoteSessions = async () => {
    if (!token || !remoteHost || !remoteUsername) return;

    setConnectionStatus('loading');
    setError(null);
    setProjects([]);
    setSelectedSession(null);

    try {
      const response = await claudeSessionsApi.listRemote(
        {
          host: remoteHost,
          port: parseInt(remotePort, 10) || 22,
          username: remoteUsername,
          password: authMethod === 'password' ? remotePassword : undefined,
          privateKey: authMethod === 'key' ? remotePrivateKey : undefined,
        },
        token
      );

      if (response.success && response.data) {
        setProjects(response.data.projects);
        setConnectionStatus('success');
        setConnectionMessage(`Found ${response.data.projects.length} project(s)`);
        // Auto-expand first project
        if (response.data.projects.length > 0) {
          setExpandedProjects(new Set([response.data.projects[0].path]));
        }
      } else {
        setConnectionStatus('error');
        setConnectionMessage(response.error?.toString() || 'Failed to load sessions');
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionMessage(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const toggleProject = (projectPath: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectPath)) {
      newExpanded.delete(projectPath);
    } else {
      newExpanded.add(projectPath);
    }
    setExpandedProjects(newExpanded);
  };

  const handleImportSession = async () => {
    if (!selectedSession || !token) return;

    setImporting(true);
    setError(null);

    try {
      // For remote sessions, we need to create an SSH terminal that resumes the Claude session
      const createParams = sessionSource === 'remote'
        ? {
            name: `Claude: ${selectedSession.session.projectName.split('/').pop() || 'Session'} (${remoteHost})`,
            cwd: selectedSession.session.cwd,
            claudeSessionId: selectedSession.session.id,
            // SSH config for remote session
            sshConfig: {
              host: remoteHost,
              port: parseInt(remotePort, 10) || 22,
              username: remoteUsername,
              password: authMethod === 'password' ? remotePassword : undefined,
              privateKey: authMethod === 'key' ? remotePrivateKey : undefined,
            },
          }
        : {
            name: `Claude: ${selectedSession.session.projectName.split('/').pop() || 'Session'}`,
            cwd: selectedSession.session.cwd,
            claudeSessionId: selectedSession.session.id,
          };

      const response = await terminalsApi.create(createParams, token);

      if (response.success && response.data) {
        onSessionImported(response.data.id);
        onClose();
      } else {
        setError(response.error?.toString() || 'Failed to create terminal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create terminal');
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncatePath = (path: string, maxLength: number = 40) => {
    if (path.length <= maxLength) return path;
    const parts = path.split('/');
    if (parts.length <= 2) return '...' + path.slice(-maxLength + 3);
    return '.../' + parts.slice(-2).join('/');
  };

  const canFetchRemote = remoteHost && remoteUsername && (authMethod === 'password' ? remotePassword : remotePrivateKey);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-100',
          'max-h-[80vh] flex flex-col'
        )}
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
            >
              <Terminal size={20} className="text-purple-500" />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                Import Claude Session
              </h2>
              <p
                className="text-sm"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Create a terminal from an existing Claude Code session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-colors duration-75',
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
            )}
          >
            <X size={20} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex border-b px-6" style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}>
          <button
            onClick={() => {
              setSessionSource('local');
              setSelectedSession(null);
              setError(null);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              sessionSource === 'local'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <Laptop size={16} />
            Local Machine
          </button>
          <button
            onClick={() => {
              setSessionSource('remote');
              setSelectedSession(null);
              setError(null);
              setProjects([]);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
              sessionSource === 'remote'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <Server size={16} />
            Remote Server
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Remote SSH Form */}
          {sessionSource === 'remote' && connectionStatus !== 'success' && (
            <div className="space-y-4 mb-6">
              <p
                className="text-sm"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Connect to a remote server to browse Claude Code sessions.
              </p>

              {/* Host and Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Host *
                  </label>
                  <input
                    type="text"
                    value={remoteHost}
                    onChange={(e) => {
                      setRemoteHost(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="192.168.1.1 or server.com"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Port
                  </label>
                  <input
                    type="text"
                    value={remotePort}
                    onChange={(e) => {
                      setRemotePort(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="22"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Username *
                </label>
                <input
                  type="text"
                  value={remoteUsername}
                  onChange={(e) => {
                    setRemoteUsername(e.target.value);
                    setConnectionStatus('idle');
                  }}
                  placeholder="root"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-mono',
                    isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                    'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                  style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                />
              </div>

              {/* Auth method toggle */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Authentication
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAuthMethod('password');
                      setConnectionStatus('idle');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      authMethod === 'password'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color: authMethod !== 'password' ? (isDark ? '#ccc' : '#444') : undefined,
                    }}
                  >
                    <Key size={16} />
                    Password
                  </button>
                  <button
                    onClick={() => {
                      setAuthMethod('key');
                      setConnectionStatus('idle');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      authMethod === 'key'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color: authMethod !== 'key' ? (isDark ? '#ccc' : '#444') : undefined,
                    }}
                  >
                    <Key size={16} />
                    Private Key
                  </button>
                </div>
              </div>

              {/* Password or Private Key */}
              {authMethod === 'password' ? (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={remotePassword}
                      onChange={(e) => {
                        setRemotePassword(e.target.value);
                        setConnectionStatus('idle');
                      }}
                      placeholder="••••••••"
                      className={cn(
                        'w-full px-3 py-2 pr-10 rounded-lg text-sm font-mono',
                        isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                        'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                      style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    >
                      {showPassword ? (
                        <EyeOff size={16} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
                      ) : (
                        <Eye size={16} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Private Key *
                  </label>
                  <textarea
                    value={remotePrivateKey}
                    onChange={(e) => {
                      setRemotePrivateKey(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    rows={4}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
              )}

              {/* Connection status */}
              {connectionStatus !== 'idle' && connectionStatus !== 'success' && (
                <div
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg text-sm',
                    connectionStatus === 'loading' && (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'),
                    connectionStatus === 'error' && (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                  )}
                >
                  {connectionStatus === 'loading' && <Loader2 size={16} className="animate-spin" />}
                  {connectionStatus === 'error' && <AlertCircle size={16} />}
                  <span>{connectionMessage}</span>
                </div>
              )}

              {/* Fetch button */}
              <button
                onClick={loadRemoteSessions}
                disabled={!canFetchRemote || connectionStatus === 'loading'}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-75',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {connectionStatus === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Fetching Sessions...
                  </span>
                ) : (
                  'Fetch Claude Sessions'
                )}
              </button>
            </div>
          )}

          {/* Remote connection success info */}
          {sessionSource === 'remote' && connectionStatus === 'success' && (
            <div
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm mb-4',
                isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
              )}
            >
              <CheckCircle size={16} />
              <span>Connected to {remoteHost} - {connectionMessage}</span>
              <button
                onClick={() => {
                  setConnectionStatus('idle');
                  setProjects([]);
                  setSelectedSession(null);
                }}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Change server
              </button>
            </div>
          )}
          {/* Session list - show for local mode always, for remote only after success */}
          {(sessionSource === 'local' || connectionStatus === 'success') && (loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : error ? (
            <div
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg',
                isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
              )}
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen
                size={48}
                className={cn('mx-auto mb-4', isDark ? 'text-gray-600' : 'text-gray-400')}
              />
              <p style={{ color: isDark ? '#888' : '#666' }}>
                No Claude Code sessions found.
              </p>
              <p className="text-sm mt-2" style={{ color: isDark ? '#666' : '#888' }}>
                Make sure Claude Code is installed and you have created some sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.path}
                  className={cn(
                    'rounded-lg border',
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  )}
                >
                  {/* Project header */}
                  <button
                    onClick={() => toggleProject(project.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-75',
                      isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                    )}
                  >
                    <ChevronRight
                      size={16}
                      className={cn(
                        'transition-transform duration-150',
                        expandedProjects.has(project.path) && 'rotate-90'
                      )}
                      style={{ color: isDark ? '#888' : '#666' }}
                    />
                    <FolderOpen size={18} className="text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium truncate"
                        style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                        title={project.name}
                      >
                        {truncatePath(project.name)}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: isDark ? '#666' : '#888' }}
                      >
                        {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>

                  {/* Sessions */}
                  {expandedProjects.has(project.path) && (
                    <div
                      className="border-t px-2 py-2"
                      style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
                    >
                      {project.sessions.map((session) => {
                        const isSelected =
                          selectedSession?.session.id === session.id &&
                          selectedSession?.projectPath === project.path;

                        return (
                          <button
                            key={session.id}
                            onClick={() =>
                              setSelectedSession({ projectPath: project.path, session })
                            }
                            className={cn(
                              'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all duration-75',
                              isSelected
                                ? 'bg-primary/10 border-primary'
                                : isDark
                                ? 'hover:bg-white/5'
                                : 'hover:bg-black/5',
                              isSelected && 'ring-1 ring-primary'
                            )}
                          >
                            <MessageSquare
                              size={16}
                              className={cn(
                                'mt-0.5 flex-shrink-0',
                                isSelected ? 'text-primary' : 'text-gray-500'
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm line-clamp-2"
                                style={{ color: isDark ? '#ddd' : '#333' }}
                              >
                                {session.firstMessage || 'Empty session'}
                              </p>
                              <div
                                className="flex items-center gap-3 mt-1 text-xs"
                                style={{ color: isDark ? '#666' : '#888' }}
                              >
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatDate(session.lastModified)}
                                </span>
                                <span>{session.messageCount} messages</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        {selectedSession && (
          <div
            className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
          >
            <div className="flex-1 min-w-0 mr-4">
              <p
                className="text-sm truncate"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Working directory: {selectedSession.session.cwd || 'Default'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSession(null)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                  isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                )}
                style={{ color: isDark ? '#ccc' : '#444' }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportSession}
                disabled={importing}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-75',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Terminal'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
