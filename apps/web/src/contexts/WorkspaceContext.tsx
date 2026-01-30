'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { useSession } from 'next-auth/react';
import {
  workspacesApi,
  terminalsApi,
  Workspace,
  WorkspaceLayout,
  WorkspaceTerminalItem,
  FloatingLayout,
  FloatingWindowPosition,
} from '@/lib/api';

// Tab represents an open terminal or file
export type TabType = 'terminal' | 'file';

export interface TerminalDisplaySettings {
  fontSize: number | null;
  fontFamily: string | null;
  theme: string | null;
}

export interface Tab {
  id: string;
  type: TabType;
  name: string;
  status?: string;
  // For terminal tabs
  terminalId?: string;
  // For file tabs
  filePath?: string;
  fileExtension?: string;
}

// Map of terminalId -> display settings
export type TerminalSettingsMap = Map<string, TerminalDisplaySettings>;

// Split pane configuration
export type SplitDirection = 'horizontal' | 'vertical';

export type PaneType = 'terminal' | 'file' | 'split';

export interface PaneNode {
  id: string;
  type: PaneType;
  // For terminal type
  terminalId?: string;
  // For file type
  filePath?: string;
  fileName?: string;
  fileExtension?: string;
  // For split type
  direction?: SplitDirection;
  children?: PaneNode[];
  sizes?: number[]; // Percentage sizes for each child
}

export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string | null;
  layout: PaneNode | null;
}

// Layout mode controls scrolling behavior in floating workspace
export type LayoutMode = 'strict' | 'flexible';

interface WorkspaceContextType {
  // Workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  loadingWorkspaces: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (data: { name: string; description?: string; color?: string; icon?: string }) => Promise<Workspace | null>;
  updateWorkspace: (workspaceId: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  reorderWorkspaces: (workspaceIds: string[]) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;

  // Pre-connection: terminal IDs that should establish WebSocket connections
  preConnectTerminalIds: string[];

  // Terminal display settings (per-terminal)
  getTerminalSettings: (terminalId: string) => TerminalDisplaySettings | undefined;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | null;
  openTab: (terminalId: string, name: string) => void;
  openFileTab: (filePath: string, fileName: string, extension?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateTabName: (tabId: string, name: string) => void;
  renameTerminal: (terminalId: string, name: string) => Promise<boolean>;

  // Split panes
  layout: PaneNode | null;
  splitPane: (paneId: string, direction: SplitDirection, newTerminalId: string) => void;
  closePane: (paneId: string) => void;
  updatePaneSizes: (paneId: string, sizes: number[]) => void;
  setSimpleLayout: (terminalId: string) => void;

  // Floating layout
  floatingLayout: FloatingLayout | null;
  updateFloatingLayout: (layout: FloatingLayout) => void;

  // Layout lock (prevents window movement/resize)
  isLayoutLocked: boolean;
  setLayoutLocked: (locked: boolean) => void;
  toggleLayoutLock: () => void;

  // Layout mode (strict = no scroll, flexible = scroll enabled)
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;

  // Quick switcher
  showQuickSwitcher: boolean;
  setShowQuickSwitcher: (show: boolean) => void;

  // Fullscreen mode
  isFullscreen: boolean;
  setFullscreen: (fullscreen: boolean) => void;
  toggleFullscreen: () => void;

  // Persistence
  clearWorkspace: () => void;
  saveLayoutToServer: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'terminal-workspace';
const CURRENT_WORKSPACE_KEY = 'terminal-current-workspace-id';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Get initial state from localStorage (fallback for offline/unauthenticated)
function getInitialState(): WorkspaceState {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          tabs: parsed.tabs || [],
          activeTabId: parsed.activeTabId || null,
          layout: parsed.layout || null,
        };
      }
    } catch (e) {
      console.error('Failed to load workspace state:', e);
    }
  }
  return { tabs: [], activeTabId: null, layout: null };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Local state (tabs, layout)
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [layout, setLayout] = useState<PaneNode | null>(null);
  const [floatingLayout, setFloatingLayout] = useState<FloatingLayout | null>(null);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [isLayoutLocked, setLayoutLocked] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('flexible');
  const [mounted, setMounted] = useState(false);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setFullscreen(prev => !prev);
  }, []);

  // Toggle layout lock
  const toggleLayoutLock = useCallback(() => {
    setLayoutLocked(prev => !prev);
  }, []);

  // Terminal IDs that should pre-connect (establish WebSocket before being visible)
  const [preConnectTerminalIds, setPreConnectTerminalIds] = useState<string[]>([]);

  // Terminal display settings (fontSize, fontFamily, theme) by terminalId
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettingsMap>(new Map());

  // Track if we've loaded initial workspaces
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current workspace object
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;

  // Get terminal display settings by terminalId
  const getTerminalSettings = useCallback((terminalId: string): TerminalDisplaySettings | undefined => {
    return terminalSettings.get(terminalId);
  }, [terminalSettings]);

  // Load workspaces from server
  const loadWorkspaces = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setLoadingWorkspaces(true);
      const response = await workspacesApi.list(session.accessToken);

      if (response.success && response.data) {
        setWorkspaces(response.data.workspaces);

        // If no workspaces exist, create a default one
        if (response.data.workspaces.length === 0) {
          const createResponse = await workspacesApi.create(
            { name: 'Default Workspace', isDefault: true },
            session.accessToken
          );
          if (createResponse.success && createResponse.data) {
            setWorkspaces([createResponse.data]);
            setCurrentWorkspaceId(createResponse.data.id);
            localStorage.setItem(CURRENT_WORKSPACE_KEY, createResponse.data.id);
          }
        } else {
          // Try to restore last used workspace from localStorage
          const savedWorkspaceId = localStorage.getItem(CURRENT_WORKSPACE_KEY);
          const workspaceExists = response.data.workspaces.some((w) => w.id === savedWorkspaceId);

          if (savedWorkspaceId && workspaceExists) {
            setCurrentWorkspaceId(savedWorkspaceId);
          } else {
            // Use the default workspace or the first one
            const defaultWorkspace = response.data.workspaces.find((w) => w.isDefault) || response.data.workspaces[0];
            setCurrentWorkspaceId(defaultWorkspace.id);
            localStorage.setItem(CURRENT_WORKSPACE_KEY, defaultWorkspace.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [session?.accessToken]);

  // Load workspace details (including layout)
  const loadWorkspaceDetails = useCallback(async (workspaceId: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await workspacesApi.get(workspaceId, session.accessToken);

      if (response.success && response.data) {
        // Update workspace in list with full details
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? { ...w, ...response.data } : w))
        );

        // Restore layout from server
        if (response.data.layout) {
          setLayout(response.data.layout as PaneNode);
        } else {
          setLayout(null);
        }

        // Restore floating layout from server
        if (response.data.floatingLayout) {
          setFloatingLayout(response.data.floatingLayout);
        } else {
          setFloatingLayout(null);
        }

        // Create tabs from workspace terminals
        if (response.data.terminals && response.data.terminals.length > 0) {
          const newTabs: Tab[] = response.data.terminals.map((t: WorkspaceTerminalItem) => ({
            id: generateId(),
            type: 'terminal' as TabType,
            terminalId: t.id,
            name: t.name,
            status: t.status,
          }));
          setTabs(newTabs);

          // Restore active tab from settings, or use first tab
          const savedActiveTerminalId = (response.data.settings as { activeTerminalId?: string } | null)?.activeTerminalId;
          const activeTab = savedActiveTerminalId
            ? newTabs.find((t) => t.terminalId === savedActiveTerminalId)
            : null;
          setActiveTabId(activeTab?.id || newTabs[0]?.id || null);

          // Set all terminal IDs for pre-connection
          const terminalIds = response.data.terminals.map((t: WorkspaceTerminalItem) => t.id);
          setPreConnectTerminalIds(terminalIds);

          // Store terminal display settings
          const newSettings = new Map<string, TerminalDisplaySettings>();
          response.data.terminals.forEach((t: WorkspaceTerminalItem) => {
            newSettings.set(t.id, {
              fontSize: t.fontSize,
              fontFamily: t.fontFamily,
              theme: t.theme,
            });
          });
          setTerminalSettings(newSettings);
        } else {
          setTabs([]);
          setActiveTabId(null);
          setPreConnectTerminalIds([]);
          setTerminalSettings(new Map());
        }
      }
    } catch (error) {
      console.error('Failed to load workspace details:', error);
    }
  }, [session?.accessToken]);

  // Load workspaces on mount (when authenticated)
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadWorkspaces();
    }
  }, [sessionStatus, loadWorkspaces]);

  // Load workspace details when current workspace changes
  useEffect(() => {
    if (currentWorkspaceId && session?.accessToken) {
      loadWorkspaceDetails(currentWorkspaceId);
    }
  }, [currentWorkspaceId, loadWorkspaceDetails, session?.accessToken]);

  // Fallback: Load state from localStorage if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      const state = getInitialState();
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
      setLayout(state.layout);
      setLoadingWorkspaces(false);
    }
    setMounted(true);
  }, [sessionStatus]);

  // Save state to localStorage (fallback for offline)
  useEffect(() => {
    if (mounted && sessionStatus === 'unauthenticated') {
      const state: WorkspaceState = { tabs, activeTabId, layout };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }
  }, [tabs, activeTabId, layout, mounted, sessionStatus]);

  // Save layout to server (debounced)
  const saveLayoutToServer = useCallback(async () => {
    if (!session?.accessToken || !currentWorkspaceId) return;

    // Find active terminal ID from current active tab
    const activeTerminalId = tabs.find((t) => t.id === activeTabId)?.terminalId;

    try {
      await workspacesApi.update(
        currentWorkspaceId,
        {
          layout: layout as WorkspaceLayout | null,
          floatingLayout: floatingLayout,
          settings: { activeTerminalId },
        },
        session.accessToken
      );
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  }, [session?.accessToken, currentWorkspaceId, layout, floatingLayout, tabs, activeTabId]);

  // Update floating layout
  const updateFloatingLayout = useCallback((newLayout: FloatingLayout) => {
    setFloatingLayout(newLayout);
  }, []);

  // Debounced save when layout or active tab changes
  useEffect(() => {
    if (!mounted || !currentWorkspaceId || sessionStatus !== 'authenticated') return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveLayoutToServer();
    }, 2000); // Save after 2 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [layout, floatingLayout, activeTabId, mounted, currentWorkspaceId, sessionStatus, saveLayoutToServer]);

  // Get active tab object
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Switch workspace
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId) return;

    // Save current layout before switching
    await saveLayoutToServer();

    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem(CURRENT_WORKSPACE_KEY, workspaceId);

    // Clear current state - it will be loaded by the effect
    setTabs([]);
    setActiveTabId(null);
    setLayout(null);
    setFloatingLayout(null);
    setPreConnectTerminalIds([]);
  }, [currentWorkspaceId, saveLayoutToServer]);

  // Create workspace
  const createWorkspace = useCallback(async (data: { name: string; description?: string; color?: string; icon?: string }) => {
    if (!session?.accessToken) return null;

    try {
      const response = await workspacesApi.create(data, session.accessToken);

      if (response.success && response.data) {
        setWorkspaces((prev) => [...prev, response.data!]);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
    return null;
  }, [session?.accessToken]);

  // Update workspace
  const updateWorkspace = useCallback(async (workspaceId: string, data: Partial<Workspace>) => {
    if (!session?.accessToken) return;

    try {
      const response = await workspacesApi.update(
        workspaceId,
        {
          name: data.name,
          description: data.description,
          color: data.color,
          icon: data.icon,
          isDefault: data.isDefault,
          position: data.position,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? { ...w, ...response.data } : w))
        );
      }
    } catch (error) {
      console.error('Failed to update workspace:', error);
    }
  }, [session?.accessToken]);

  // Delete workspace
  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await workspacesApi.delete(workspaceId, session.accessToken);

      if (response.success) {
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));

        // If we deleted the current workspace, switch to another
        if (currentWorkspaceId === workspaceId) {
          const remaining = workspaces.filter((w) => w.id !== workspaceId);
          const defaultWs = remaining.find((w) => w.isDefault) || remaining[0];
          if (defaultWs) {
            switchWorkspace(defaultWs.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  }, [session?.accessToken, currentWorkspaceId, workspaces, switchWorkspace]);

  // Reorder workspaces
  const reorderWorkspaces = useCallback(async (workspaceIds: string[]) => {
    if (!session?.accessToken) return;

    // Optimistic update
    setWorkspaces((prev) => {
      const ordered: Workspace[] = [];
      for (const id of workspaceIds) {
        const ws = prev.find((w) => w.id === id);
        if (ws) ordered.push(ws);
      }
      return ordered;
    });

    try {
      await workspacesApi.reorder({ workspaceIds }, session.accessToken);
    } catch (error) {
      console.error('Failed to reorder workspaces:', error);
      // Revert on error
      await loadWorkspaces();
    }
  }, [session?.accessToken, loadWorkspaces]);

  // Refresh workspaces
  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces();
  }, [loadWorkspaces]);

  // Open a new terminal tab
  const openTab = useCallback((terminalId: string, name: string) => {
    // Check if terminal is already open
    setTabs((prev) => {
      const existing = prev.find((t) => t.type === 'terminal' && t.terminalId === terminalId);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }

      const newTab: Tab = {
        id: generateId(),
        type: 'terminal',
        terminalId,
        name,
      };
      setActiveTabId(newTab.id);

      // Also set simple layout if no layout exists
      setLayout((currentLayout) => {
        if (!currentLayout) {
          return {
            id: generateId(),
            type: 'terminal',
            terminalId,
          };
        }
        return currentLayout;
      });

      // Save terminal to workspace on server (fire and forget)
      if (session?.accessToken && currentWorkspaceId) {
        workspacesApi.addTerminal(
          currentWorkspaceId,
          { terminalId },
          session.accessToken
        ).catch((err) => console.error('Failed to add terminal to workspace:', err));
      }

      return [...prev, newTab];
    });
  }, [session?.accessToken, currentWorkspaceId]);

  // Open a new file tab
  const openFileTab = useCallback((filePath: string, fileName: string, extension?: string) => {
    setTabs((prev) => {
      // Check if file is already open
      const existing = prev.find((t) => t.type === 'file' && t.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        // Update layout to show this file
        setLayout({
          id: generateId(),
          type: 'file',
          filePath,
          fileName,
          fileExtension: extension,
        });
        return prev;
      }

      const newTab: Tab = {
        id: generateId(),
        type: 'file',
        name: fileName,
        filePath,
        fileExtension: extension,
      };
      setActiveTabId(newTab.id);

      // Set layout to show this file
      setLayout({
        id: generateId(),
        type: 'file',
        filePath,
        fileName,
        fileExtension: extension,
      });

      return [...prev, newTab];
    });
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;

      const closedTab = prev[index];
      const newTabs = prev.filter((t) => t.id !== tabId);

      // Remove terminal from workspace on server (fire and forget)
      if (closedTab.type === 'terminal' && closedTab.terminalId && session?.accessToken && currentWorkspaceId) {
        workspacesApi.removeTerminal(
          currentWorkspaceId,
          closedTab.terminalId,
          session.accessToken
        ).catch((err) => console.error('Failed to remove terminal from workspace:', err));
      }

      // If closing active tab, activate adjacent tab
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(index, newTabs.length - 1);
        const newActiveTab = newTabs[newActiveIndex];
        setActiveTabId(newActiveTab.id);

        // Update layout based on tab type
        if (newActiveTab.type === 'file') {
          setLayout({
            id: generateId(),
            type: 'file',
            filePath: newActiveTab.filePath,
            fileName: newActiveTab.name,
            fileExtension: newActiveTab.fileExtension,
          });
        } else {
          setLayout({
            id: generateId(),
            type: 'terminal',
            terminalId: newActiveTab.terminalId,
          });
        }
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
        setLayout(null);
      }

      return newTabs;
    });
  }, [activeTabId, session?.accessToken, currentWorkspaceId]);

  // Set active tab
  const handleSetActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);

    // Update layout based on tab type
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab) {
        if (tab.type === 'file') {
          setLayout({
            id: generateId(),
            type: 'file',
            filePath: tab.filePath,
            fileName: tab.name,
            fileExtension: tab.fileExtension,
          });
        } else {
          setLayout({
            id: generateId(),
            type: 'terminal',
            terminalId: tab.terminalId,
          });
        }
      }
      return prev;
    });
  }, []);

  // Reorder tabs
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);

      // Save new order to server (fire and forget)
      if (session?.accessToken && currentWorkspaceId) {
        const terminalIds = newTabs
          .filter((t) => t.type === 'terminal' && t.terminalId)
          .map((t) => t.terminalId!);

        if (terminalIds.length > 0) {
          workspacesApi.reorderTerminals(
            currentWorkspaceId,
            { terminalIds },
            session.accessToken
          ).catch((err) => console.error('Failed to save tab order:', err));
        }
      }

      return newTabs;
    });
  }, [session?.accessToken, currentWorkspaceId]);

  // Update tab name (local only)
  const updateTabName = useCallback((tabId: string, name: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, name } : t))
    );
  }, []);

  // Rename terminal (persists to server)
  const renameTerminal = useCallback(async (terminalId: string, name: string): Promise<boolean> => {
    if (!session?.accessToken) return false;

    try {
      const response = await terminalsApi.update(terminalId, { name }, session.accessToken);
      if (response.success) {
        // Update tab name locally
        setTabs((prev) =>
          prev.map((t) => (t.terminalId === terminalId ? { ...t, name } : t))
        );
        return true;
      }
    } catch (error) {
      console.error('Failed to rename terminal:', error);
    }
    return false;
  }, [session?.accessToken]);

  // Set simple single-terminal layout
  const setSimpleLayout = useCallback((terminalId: string) => {
    setLayout({
      id: generateId(),
      type: 'terminal',
      terminalId,
    });
  }, []);

  // Split a pane
  const splitPane = useCallback(
    (paneId: string, direction: SplitDirection, newTerminalId: string) => {
      setLayout((prev) => {
        if (!prev) return prev;

        function splitNode(node: PaneNode): PaneNode {
          if (node.id === paneId) {
            // Create split with current terminal and new one
            return {
              id: generateId(),
              type: 'split',
              direction,
              sizes: [50, 50],
              children: [
                { ...node, id: generateId() },
                {
                  id: generateId(),
                  type: 'terminal',
                  terminalId: newTerminalId,
                },
              ],
            };
          }

          if (node.children) {
            return {
              ...node,
              children: node.children.map(splitNode),
            };
          }

          return node;
        }

        return splitNode(prev);
      });

      // Also open a tab for the new terminal
      const terminalName = `Terminal ${newTerminalId.slice(-4)}`;
      openTab(newTerminalId, terminalName);
    },
    [openTab]
  );

  // Close a pane
  const closePane = useCallback((paneId: string) => {
    setLayout((prev) => {
      if (!prev) return prev;

      function removeNode(node: PaneNode, parent: PaneNode | null): PaneNode | null {
        if (node.id === paneId) {
          return null;
        }

        if (node.children) {
          const newChildren = node.children
            .map((child) => removeNode(child, node))
            .filter((c): c is PaneNode => c !== null);

          // If only one child left, promote it
          if (newChildren.length === 1) {
            return newChildren[0];
          }

          // If no children, remove this split
          if (newChildren.length === 0) {
            return null;
          }

          return {
            ...node,
            children: newChildren,
            sizes: newChildren.map(() => 100 / newChildren.length),
          };
        }

        return node;
      }

      return removeNode(prev, null);
    });
  }, []);

  // Update pane sizes
  const updatePaneSizes = useCallback((paneId: string, sizes: number[]) => {
    setLayout((prev) => {
      if (!prev) return prev;

      function updateNode(node: PaneNode): PaneNode {
        if (node.id === paneId) {
          return { ...node, sizes };
        }

        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNode),
          };
        }

        return node;
      }

      return updateNode(prev);
    });
  }, []);

  // Clear workspace
  const clearWorkspace = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    setLayout(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        // Workspaces
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        loadingWorkspaces,
        switchWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        reorderWorkspaces,
        refreshWorkspaces,
        preConnectTerminalIds,
        getTerminalSettings,
        // Tabs
        tabs,
        activeTabId,
        activeTab,
        openTab,
        openFileTab,
        closeTab,
        setActiveTab: handleSetActiveTab,
        reorderTabs,
        updateTabName,
        renameTerminal,
        // Layout
        layout,
        splitPane,
        closePane,
        updatePaneSizes,
        setSimpleLayout,
        // Floating layout
        floatingLayout,
        updateFloatingLayout,
        // Layout lock
        isLayoutLocked,
        setLayoutLocked,
        toggleLayoutLock,
        // Layout mode
        layoutMode,
        setLayoutMode,
        // Quick switcher
        showQuickSwitcher,
        setShowQuickSwitcher,
        // Fullscreen
        isFullscreen,
        setFullscreen,
        toggleFullscreen,
        // Persistence
        clearWorkspace,
        saveLayoutToServer,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
