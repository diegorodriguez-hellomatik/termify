'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Edit2,
  Terminal as TerminalIcon,
  X,
  File,
  FileCode,
  FileJson,
  FileText,
  Plus,
  ChevronDown,
  Share2,
  Users,
  Loader2,
} from 'lucide-react';
import { TerminalStatus } from '@termify/shared';
import { terminalsApi } from '@/lib/api';
import { FileViewer } from '@/components/files/FileViewer';
import { ShareTerminalModal } from '@/components/terminals/ShareTerminalModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { CreateTerminalModal, SSHConfig } from '@/components/terminals/CreateTerminalModal';
import { ClaudeSessionsModal } from '@/components/terminals/ClaudeSessionsModal';
import { cn } from '@/lib/utils';

// Dynamic import to avoid SSR issues with xterm.js
const Terminal = dynamic(
  () => import('@/components/terminal/Terminal').then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

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

type TabType = 'terminal' | 'file';

interface Tab {
  id: string;
  type: TabType;
  name: string;
  // For terminal tabs
  terminalId?: string;
  // For file tabs
  filePath?: string;
  fileExtension?: string;
}

// Get icon for file based on extension
function getFileIcon(extension?: string) {
  switch (extension) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'php':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'css':
    case 'scss':
    case 'html':
    case 'sh':
      return FileCode;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return FileJson;
    case 'md':
    case 'txt':
    case 'log':
      return FileText;
    default:
      return File;
  }
}

// Get icon color for file based on extension
function getFileIconColor(extension?: string): string {
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'text-blue-500';
    case 'js':
    case 'jsx':
      return 'text-yellow-400';
    case 'json':
      return 'text-yellow-600';
    case 'py':
      return 'text-green-500';
    case 'md':
      return 'text-gray-400';
    case 'css':
    case 'scss':
      return 'text-pink-500';
    case 'html':
      return 'text-orange-500';
    default:
      return 'text-muted-foreground';
  }
}

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const [terminal, setTerminal] = useState<TerminalData | null>(null);
  const [allTerminals, setAllTerminals] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [readyTerminals, setReadyTerminals] = useState<Set<string>>(new Set());
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClaudeModal, setShowClaudeModal] = useState(false);

  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Terminal picker dropdown
  const [showTerminalPicker, setShowTerminalPicker] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);

  const terminalId = params.id as string;

  // Load all terminals for the picker
  useEffect(() => {
    const loadAllTerminals = async () => {
      if (!session?.accessToken) return;
      try {
        const response = await terminalsApi.list(session.accessToken);
        if (response.success && response.data) {
          setAllTerminals(response.data.terminals);
        }
      } catch (err) {
        console.error('Failed to load terminals:', err);
      }
    };

    if (sessionStatus === 'authenticated') {
      loadAllTerminals();
    }
  }, [session?.accessToken, sessionStatus]);

  // Initialize terminal tab when terminal loads
  useEffect(() => {
    if (terminal && tabs.length === 0) {
      const terminalTab: Tab = {
        id: `terminal-${terminal.id}`,
        type: 'terminal',
        name: terminal.name,
        terminalId: terminal.id,
      };
      setTabs([terminalTab]);
      setActiveTabId(terminalTab.id);
    }
  }, [terminal, tabs.length]);

  // Update terminal tab name when terminal name changes
  useEffect(() => {
    if (terminal) {
      setTabs(prev =>
        prev.map(tab =>
          tab.terminalId === terminal.id ? { ...tab, name: terminal.name } : tab
        )
      );
    }
  }, [terminal?.name, terminal?.id]);

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

  // Listen for file open events from FileExplorer
  useEffect(() => {
    const handleFileOpen = (
      event: CustomEvent<{
        terminalId: string;
        file: { path: string; name: string; extension?: string };
      }>
    ) => {
      // Accept file open from any terminal in our tabs
      const openTerminalIds = tabs
        .filter(t => t.type === 'terminal')
        .map(t => t.terminalId);

      if (openTerminalIds.includes(event.detail.terminalId)) {
        const file = event.detail.file;
        const ext = file.extension || file.name.split('.').pop()?.toLowerCase();

        // Check if file tab already exists
        const existingTab = tabs.find(
          t => t.type === 'file' && t.filePath === file.path
        );
        if (existingTab) {
          setActiveTabId(existingTab.id);
          return;
        }

        // Create new file tab
        const newTab: Tab = {
          id: `file-${Date.now()}`,
          type: 'file',
          name: file.name,
          filePath: file.path,
          fileExtension: ext,
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    };

    window.addEventListener('file-open', handleFileOpen as EventListener);
    return () => {
      window.removeEventListener('file-open', handleFileOpen as EventListener);
    };
  }, [tabs]);

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

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs(prev => {
        // Don't allow closing if it's the last terminal tab
        const terminalTabs = prev.filter(t => t.type === 'terminal');
        const tabToClose = prev.find(t => t.id === tabId);
        if (tabToClose?.type === 'terminal' && terminalTabs.length <= 1) {
          return prev;
        }

        const newTabs = prev.filter(t => t.id !== tabId);

        // If closing active tab, switch to another tab
        if (activeTabId === tabId && newTabs.length > 0) {
          const index = prev.findIndex(t => t.id === tabId);
          const newActiveIndex = Math.min(index, newTabs.length - 1);
          setActiveTabId(newTabs[newActiveIndex].id);
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

  const addTerminalTab = useCallback((terminalToAdd: TerminalData) => {
    // Check if already open
    const existing = tabs.find(
      t => t.type === 'terminal' && t.terminalId === terminalToAdd.id
    );
    if (existing) {
      setActiveTabId(existing.id);
      setShowTerminalPicker(false);
      return;
    }

    const newTab: Tab = {
      id: `terminal-${terminalToAdd.id}`,
      type: 'terminal',
      name: terminalToAdd.name,
      terminalId: terminalToAdd.id,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowTerminalPicker(false);
  }, [tabs]);

  const createNewTerminal = useCallback(async () => {
    if (!session?.accessToken) {
      setCreateError('No access token');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setShowTerminalPicker(false);

    try {
      console.log('Creating new terminal...');
      const response = await terminalsApi.create(
        { name: `Terminal ${allTerminals.length + 1}` },
        session.accessToken
      );

      console.log('Create terminal response:', response);

      if (response.success && response.data) {
        // Add to all terminals list
        setAllTerminals(prev => [...prev, response.data]);
        // Add as a new tab
        addTerminalTab(response.data);
      } else {
        const errorMsg = Array.isArray(response.error)
          ? response.error.join(', ')
          : (response.error || 'Failed to create terminal');
        setCreateError(errorMsg);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create terminal');
    } finally {
      setIsCreating(false);
    }
  }, [session?.accessToken, allTerminals.length, addTerminalTab]);

  // Handle SSH terminal creation (from CreateTerminalModal)
  const handleCreateSSHTerminal = useCallback(async (config: SSHConfig) => {
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.createSSH(
        {
          name: config.name || `${config.username}@${config.host}`,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          privateKey: config.privateKey,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        setAllTerminals(prev => [...prev, response.data]);
        addTerminalTab(response.data);
      }
    } catch (error) {
      console.error('Failed to create SSH terminal:', error);
    }
  }, [session?.accessToken, addTerminalTab]);

  // Handle Claude session import
  const handleClaudeSessionImported = useCallback((terminalId: string) => {
    const loadNewTerminal = async () => {
      if (!session?.accessToken) return;
      try {
        const response = await terminalsApi.get(terminalId, session.accessToken);
        if (response.success && response.data) {
          setAllTerminals(prev => [...prev, response.data]);
          addTerminalTab(response.data);
        }
      } catch (error) {
        console.error('Failed to load imported terminal:', error);
      }
    };
    loadNewTerminal();
  }, [session?.accessToken, addTerminalTab]);

  const handleTerminalReady = useCallback((termId: string) => {
    setReadyTerminals(prev => new Set(prev).add(termId));
  }, []);

  // Fallback: Force show terminal after 3 seconds regardless of ready state
  useEffect(() => {
    const terminalIds = tabs
      .filter(t => t.type === 'terminal' && t.terminalId)
      .map(t => t.terminalId!);

    const timeouts = terminalIds.map(termId => {
      if (!readyTerminals.has(termId)) {
        return setTimeout(() => {
          setReadyTerminals(prev => new Set(prev).add(termId));
        }, 3000);
      }
      return null;
    });

    return () => {
      timeouts.forEach(t => t && clearTimeout(t));
    };
  }, [tabs, readyTerminals]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeTerminalId = activeTab?.type === 'terminal' ? activeTab.terminalId : null;

  // Get the current terminal for file operations
  const currentTerminalForFiles = activeTab?.type === 'terminal'
    ? activeTab.terminalId
    : tabs.find(t => t.type === 'terminal')?.terminalId || terminalId;

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
          The terminal you&apos;re looking for doesn&apos;t exist or has been
          deleted.
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

  // Get terminals not yet open
  const availableTerminals = allTerminals.filter(
    t => !tabs.some(tab => tab.type === 'terminal' && tab.terminalId === t.id)
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
                onChange={e => setNewName(e.target.value)}
                className="h-8 w-48"
                onKeyDown={e => {
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
            <div className="flex items-center gap-2 group">
              <h1 className="text-lg font-semibold transition-colors duration-100">{terminal.name}</h1>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded transition-all duration-75 opacity-0 group-hover:opacity-100 hover:bg-muted hover:scale-110 active:scale-95"
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {tabs.filter(t => t.type === 'terminal').length} terminal
              {tabs.filter(t => t.type === 'terminal').length !== 1 ? 's' : ''}
            </span>
            <span className="mx-2">|</span>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="flex items-center gap-1 px-2 py-1 border-b border-border overflow-x-auto"
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const Icon =
            tab.type === 'terminal'
              ? TerminalIcon
              : getFileIcon(tab.fileExtension);
          const iconColor =
            tab.type === 'terminal'
              ? 'text-muted-foreground'
              : getFileIconColor(tab.fileExtension);

          const canClose =
            tab.type === 'file' ||
            tabs.filter(t => t.type === 'terminal').length > 1;

          return (
            <div
              key={tab.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer min-w-[100px] max-w-[200px]',
                'transition-all duration-100 ease-out',
                'hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? 'bg-background border-primary shadow-sm'
                  : 'bg-muted/50 border-transparent hover:bg-muted'
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <Icon size={14} className={cn('flex-shrink-0', iconColor)} />
              <span className="text-sm font-medium truncate flex-1">
                {tab.name}
              </span>
              {canClose && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    'p-0.5 rounded flex-shrink-0',
                    'transition-all duration-75 ease-out',
                    'hover:bg-destructive/20 hover:scale-110 active:scale-95',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X
                    size={12}
                    className="text-muted-foreground transition-colors duration-75 hover:text-destructive"
                  />
                </button>
              )}
            </div>
          );
        })}

        {/* Add tab dropdown */}
        <div className="flex-shrink-0">
          <button
            ref={addButtonRef}
            onClick={() => {
              if (addButtonRef.current) {
                const rect = addButtonRef.current.getBoundingClientRect();
                setDropdownPosition({
                  top: rect.bottom + 4,
                  right: window.innerWidth - rect.right
                });
              }
              setShowTerminalPicker(!showTerminalPicker);
            }}
            className="p-1.5 rounded flex items-center gap-1 transition-all duration-100 hover:bg-muted hover:scale-110 active:scale-95"
            title="Add terminal or file"
          >
            <Plus size={16} className="text-muted-foreground" />
            <ChevronDown size={12} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Dropdown Portal - outside tab bar to avoid overflow clipping */}
      {showTerminalPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTerminalPicker(false)}
          />

          {/* Dropdown */}
          <div
            className="fixed z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg py-1 animate-in fade-in duration-75"
            style={{
              top: dropdownPosition.top,
              right: dropdownPosition.right,
            }}
            onClick={(e) => e.stopPropagation()}
          >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTerminalPicker(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-all duration-75 hover:bg-muted hover:pl-4"
                >
                  <Plus size={14} className="text-primary" />
                  <span>New Terminal</span>
                </button>

                {availableTerminals.length > 0 && (
                  <>
                    <div className="border-t border-border my-1" />
                    <div className="px-3 py-1 text-xs text-muted-foreground">
                      Open existing
                    </div>
                    {availableTerminals.slice(0, 10).map(t => (
                      <button
                        key={t.id}
                        onClick={() => addTerminalTab(t)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-all duration-75 hover:bg-muted hover:pl-4"
                      >
                        <TerminalIcon size={14} className="text-muted-foreground transition-transform duration-75 group-hover:scale-110" />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                    {availableTerminals.length > 10 && (
                      <div className="px-3 py-1 text-xs text-muted-foreground">
                        +{availableTerminals.length - 10} more...
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

      {/* Error message */}
      {createError && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-100">
          <span>Error: {createError}</span>
          <button
            onClick={() => setCreateError(null)}
            className="text-destructive transition-all duration-75 hover:text-destructive/80 hover:scale-110 active:scale-95"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main content area - header ~52px, tabs ~40px */}
      {session?.accessToken && (
        <div
          className="relative w-full"
          style={{ height: 'calc(100vh - 52px - 40px)' }}
        >
          {/* Render all terminal tabs */}
          {tabs
            .filter(tab => tab.type === 'terminal' && tab.terminalId)
            .map(tab => {
              const isActive = tab.id === activeTabId;
              const isReady = readyTerminals.has(tab.terminalId!);

              return (
                <div
                  key={tab.id}
                  className="absolute inset-0"
                  style={{ display: isActive ? 'block' : 'none' }}
                >
                  {/* Loading Overlay */}
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
                              className="text-primary"
                              style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
                            />
                          </div>
                          <div className="absolute -inset-2">
                            <svg
                              className="w-full h-full animate-spin"
                              viewBox="0 0 100 100"
                            >
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
                            Launching terminal
                          </h3>
                          <p
                            className="text-sm"
                            style={{ color: isDark ? '#888' : '#666' }}
                          >
                            Connecting to your session...
                          </p>
                        </div>

                        <div className="flex gap-1.5">
                          {[0, 1, 2].map(i => (
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
                    terminalId={tab.terminalId as string}
                    token={session.accessToken as string}
                    className="absolute inset-0"
                    isActive={isActive}
                    onReady={() => handleTerminalReady(tab.terminalId as string)}
                  />
                </div>
              );
            })}

          {/* File Viewer - shown when file tab is active */}
          {activeTab?.type === 'file' && activeTab.filePath && currentTerminalForFiles && (
            <div className="h-full">
              <FileViewer
                terminalId={currentTerminalForFiles}
                filePath={activeTab.filePath}
                fileName={activeTab.name}
                extension={activeTab.fileExtension}
                className="h-full"
              />
            </div>
          )}
        </div>
      )}

      {/* Share Modal */}
      <ShareTerminalModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        terminalId={terminal.id}
        terminalName={terminal.name}
        isDark={isDark}
        token={session?.accessToken}
      />

      {/* Create terminal modal */}
      <CreateTerminalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateLocal={createNewTerminal}
        onCreateSSH={handleCreateSSHTerminal}
        onImportClaude={() => {
          setShowCreateModal(false);
          setShowClaudeModal(true);
        }}
        isDark={isDark}
        token={session?.accessToken}
      />

      {/* Claude sessions modal */}
      <ClaudeSessionsModal
        isOpen={showClaudeModal}
        onClose={() => setShowClaudeModal(false)}
        onSessionImported={handleClaudeSessionImported}
        isDark={isDark}
        token={session?.accessToken}
      />
    </div>
  );
}
