'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Terminal as TerminalIcon, Keyboard, LayoutGrid } from 'lucide-react';
import { terminalsApi, TerminalProfile } from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { WorkspaceProvider, useWorkspace, PaneNode } from '@/contexts/WorkspaceContext';
import { TabBar } from '@/components/workspace/TabBar';
import { SplitPane } from '@/components/workspace/SplitPane';
import { QuickSwitcher } from '@/components/workspace/QuickSwitcher';
import { QuickActionsToolbar } from '@/components/workspace/QuickActionsToolbar';
import { TerminalThemeSelector } from '@/components/settings/TerminalThemeSelector';
import { ShortcutsHelpModal } from '@/components/ui/ShortcutsHelpModal';
import { cn } from '@/lib/utils';

interface TerminalData {
  id: string;
  name: string;
  status: string;
  cols: number;
  rows: number;
  createdAt: string;
  lastActiveAt: string | null;
  isFavorite?: boolean;
  category?: { id: string; name: string; color: string } | null;
}

function WorkspaceContent() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isDark } = useTheme();
  const {
    tabs,
    activeTab,
    layout,
    openTab,
    splitPane,
    showQuickSwitcher,
    setShowQuickSwitcher,
    setSimpleLayout,
  } = useWorkspace();

  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [pendingSplit, setPendingSplit] = useState<{
    direction: 'horizontal' | 'vertical';
    sourceTerminalId: string;
  } | null>(null);

  // Load terminals
  useEffect(() => {
    const loadTerminals = async () => {
      if (!session?.accessToken) return;

      try {
        const response = await terminalsApi.list(session.accessToken);
        if (response.success && response.data) {
          setTerminals(response.data.terminals);
        }
      } catch (error) {
        console.error('Failed to load terminals:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sessionStatus === 'authenticated') {
      loadTerminals();
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [session?.accessToken, sessionStatus, router]);

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }

      // Show shortcuts help with ? or Shift+?
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowQuickSwitcher]);

  // Open terminal and create tab
  const handleOpenTerminal = useCallback(
    (terminalId: string, name: string) => {
      openTab(terminalId, name);
    },
    [openTab]
  );

  // Create new terminal
  const handleCreateTerminal = async () => {
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.create(
        { name: `Terminal ${terminals.length + 1}` },
        session.accessToken
      );

      if (response.success && response.data) {
        // Add to local list
        setTerminals((prev) => [...prev, response.data]);
        // Open in workspace
        openTab(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  };

  // Create terminal with profile
  const handleCreateTerminalWithProfile = async (profile: TerminalProfile) => {
    if (!session?.accessToken) return;

    try {
      const response = await terminalsApi.create(
        {
          name: profile.name,
          cols: profile.cols,
          rows: profile.rows,
          cwd: profile.cwd || undefined,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        setTerminals((prev) => [...prev, response.data]);
        openTab(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal with profile:', error);
    }
  };

  // Handle snippet use (send to active terminal)
  const handleUseSnippet = (command: string) => {
    // TODO: Send command to active terminal via WebSocket
    console.log('Use snippet:', command);
  };

  // Handle adding a tab (shows quick switcher or creates new)
  const handleAddTab = () => {
    if (terminals.length > 0) {
      setShowQuickSwitcher(true);
    } else {
      handleCreateTerminal();
    }
  };

  // Handle split - show terminal picker
  const handleSplitHorizontal = (currentTerminalId: string) => {
    setPendingSplit({ direction: 'horizontal', sourceTerminalId: currentTerminalId });
    setShowQuickSwitcher(true);
  };

  const handleSplitVertical = (currentTerminalId: string) => {
    setPendingSplit({ direction: 'vertical', sourceTerminalId: currentTerminalId });
    setShowQuickSwitcher(true);
  };

  // Helper to find pane ID
  const findPaneId = useCallback((terminalId: string): string | null => {
    if (!layout) return null;

    const find = (node: PaneNode): string | null => {
      if (node.type === 'terminal' && node.terminalId === terminalId) {
        return node.id;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };

    return find(layout);
  }, [layout]);

  // Execute split with selected terminal
  const executeSplit = useCallback((terminalId: string, name: string) => {
    if (!pendingSplit) {
      // Normal open
      openTab(terminalId, name);
      return;
    }

    const paneId = findPaneId(pendingSplit.sourceTerminalId);
    if (paneId) {
      splitPane(paneId, pendingSplit.direction, terminalId);
      // Also open a tab for it if not already open
      openTab(terminalId, name);
    }
    setPendingSplit(null);
  }, [pendingSplit, findPaneId, splitPane, openTab]);

  // Create new terminal for split
  const handleCreateNewForSplit = async () => {
    if (!session?.accessToken || !pendingSplit) return;

    try {
      const response = await terminalsApi.create(
        { name: `Terminal ${terminals.length + 1}` },
        session.accessToken
      );

      if (response.success && response.data) {
        setTerminals((prev) => [...prev, response.data]);
        executeSplit(response.data.id, response.data.name);
      }
    } catch (error) {
      console.error('Failed to create terminal for split:', error);
    }
  };

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border"
        style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}
      >
        <div className="flex items-center gap-3">
          <LayoutGrid size={18} className="text-primary" />
          <h1 className="text-sm font-semibold">Workspace</h1>
          <span className="text-xs text-muted-foreground">
            {tabs.length} terminal{tabs.length !== 1 ? 's' : ''} open
          </span>
        </div>

        <div className="flex items-center gap-2">
          {session?.accessToken && (
            <QuickActionsToolbar
              token={session.accessToken}
              onNewTerminal={handleCreateTerminal}
              onNewTerminalWithProfile={handleCreateTerminalWithProfile}
              onUseSnippet={handleUseSnippet}
              onOpenQuickSwitcher={() => setShowQuickSwitcher(true)}
              onOpenShortcuts={() => setShowShortcuts(true)}
              onOpenThemes={() => setShowThemeSelector(!showThemeSelector)}
              onSplitHorizontal={activeTab?.type === 'terminal' && activeTab.terminalId ? () => handleSplitHorizontal(activeTab.terminalId!) : undefined}
              onSplitVertical={activeTab?.type === 'terminal' && activeTab.terminalId ? () => handleSplitVertical(activeTab.terminalId!) : undefined}
            />
          )}

          <TerminalThemeSelector showLabel={false} />
        </div>
      </div>

      {/* Tab bar */}
      <TabBar onAddTab={handleAddTab} isDark={isDark} />

      {/* Main content - header ~44px, tabs ~40px */}
      <div
        className="relative w-full"
        style={{ height: 'calc(100vh - 44px - 40px)' }}
      >
        {!layout || tabs.length === 0 ? (
          // Empty state
          <div
            className="h-full flex flex-col items-center justify-center p-8"
            style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
              }}
            >
              <TerminalIcon size={40} className="text-muted-foreground" />
            </div>

            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: isDark ? '#fff' : '#1a1a1a' }}
            >
              No terminals open
            </h2>
            <p
              className="text-center mb-6 max-w-md"
              style={{ color: isDark ? '#888' : '#666' }}
            >
              Open a terminal to get started. You can have multiple terminals open in tabs
              and split the view horizontally or vertically.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowQuickSwitcher(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                  isDark
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-black/5 hover:bg-black/10 text-black'
                )}
              >
                <Keyboard size={16} />
                Open Terminal
                <kbd
                  className={cn(
                    'ml-2 px-1.5 py-0.5 rounded text-xs font-mono',
                    isDark ? 'bg-white/10' : 'bg-black/5'
                  )}
                >
                  ⌘K
                </kbd>
              </button>

              <button
                onClick={handleCreateTerminal}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all"
              >
                <Plus size={16} />
                Create New
              </button>
            </div>
          </div>
        ) : (
          // Split pane layout
          session?.accessToken && (
            <SplitPane
              node={layout}
              token={session.accessToken}
              isDark={isDark}
              activeTerminalId={activeTab?.type === 'terminal' ? activeTab.terminalId : tabs.find(t => t.type === 'terminal')?.terminalId}
              onSplitHorizontal={handleSplitHorizontal}
              onSplitVertical={handleSplitVertical}
            />
          )
        )}
      </div>

      {/* Quick switcher */}
      <QuickSwitcher
        terminals={terminals.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          lastActiveAt: t.lastActiveAt,
          createdAt: t.createdAt,
          isFavorite: t.isFavorite,
          categoryName: t.category?.name,
          categoryColor: t.category?.color,
        }))}
        onSelect={pendingSplit ? executeSplit : handleOpenTerminal}
        onClose={() => {
          setShowQuickSwitcher(false);
          setPendingSplit(null);
        }}
        isDark={isDark}
        mode={pendingSplit ? { type: 'split', ...pendingSplit } : 'open'}
        onCreateNew={pendingSplit ? handleCreateNewForSplit : undefined}
      />

      {/* Shortcuts help modal */}
      <ShortcutsHelpModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
