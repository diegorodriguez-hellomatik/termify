'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import { TerminalStatus } from '@claude-terminal/shared';
import { terminalsApi } from '@/lib/api';
import { Terminal } from '@/components/terminal/Terminal';
import { FileViewer } from '@/components/files/FileViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

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

  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Terminal picker dropdown
  const [showTerminalPicker, setShowTerminalPicker] = useState(false);

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
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.create(
        { name: `Terminal ${allTerminals.length + 1}` },
        session.accessToken
      );

      if (response.success && response.data) {
        // Add to all terminals list
        setAllTerminals(prev => [...prev, response.data]);
        // Add as a new tab
        addTerminalTab(response.data);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
    }
  }, [session?.accessToken, allTerminals.length, addTerminalTab]);

  const handleTerminalReady = useCallback((termId: string) => {
    setReadyTerminals(prev => new Set(prev).add(termId));
  }, []);

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
                'group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer transition-all min-w-[100px] max-w-[200px]',
                isActive
                  ? 'bg-background border-primary'
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
                    'p-0.5 rounded hover:bg-destructive/20 transition-colors flex-shrink-0',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X
                    size={12}
                    className="text-muted-foreground hover:text-destructive"
                  />
                </button>
              )}
            </div>
          );
        })}

        {/* Add tab dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTerminalPicker(!showTerminalPicker)}
            className="p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0 flex items-center gap-1"
            title="Add terminal or file"
          >
            <Plus size={16} className="text-muted-foreground" />
            <ChevronDown size={12} className="text-muted-foreground" />
          </button>

          {showTerminalPicker && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTerminalPicker(false)}
              />

              {/* Dropdown */}
              <div
                className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg py-1"
              >
                <button
                  onClick={createNewTerminal}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                      >
                        <TerminalIcon size={14} className="text-muted-foreground" />
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
        </div>
      </div>

      {/* Main content area */}
      {session?.accessToken && (
        <div className="flex-1 min-h-0 relative">
          {/* Render all terminal tabs (hidden when not active) */}
          {tabs
            .filter(tab => tab.type === 'terminal' && tab.terminalId)
            .map(tab => {
              const isActive = tab.id === activeTabId;
              const isReady = readyTerminals.has(tab.terminalId!);

              return (
                <div
                  key={tab.id}
                  className={cn('absolute inset-0', !isActive && 'hidden')}
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
                            Starting Terminal
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
                    className="h-full"
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
    </div>
  );
}
