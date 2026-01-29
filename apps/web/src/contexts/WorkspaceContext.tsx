'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

// Tab represents an open terminal
export interface Tab {
  id: string;
  terminalId: string;
  name: string;
  status?: string;
}

// Split pane configuration
export type SplitDirection = 'horizontal' | 'vertical';

export interface PaneNode {
  id: string;
  type: 'terminal' | 'split';
  // For terminal type
  terminalId?: string;
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

interface WorkspaceContextType {
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | null;
  openTab: (terminalId: string, name: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateTabName: (tabId: string, name: string) => void;

  // Split panes
  layout: PaneNode | null;
  splitPane: (paneId: string, direction: SplitDirection, newTerminalId: string) => void;
  closePane: (paneId: string) => void;
  updatePaneSizes: (paneId: string, sizes: number[]) => void;
  setSimpleLayout: (terminalId: string) => void;

  // Quick switcher
  showQuickSwitcher: boolean;
  setShowQuickSwitcher: (show: boolean) => void;

  // Persistence
  clearWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'terminal-workspace';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Get initial state from localStorage
function getInitialState(): WorkspaceState {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [layout, setLayout] = useState<PaneNode | null>(null);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load state on mount
  useEffect(() => {
    const state = getInitialState();
    setTabs(state.tabs);
    setActiveTabId(state.activeTabId);
    setLayout(state.layout);
    setMounted(true);
  }, []);

  // Save state on change
  useEffect(() => {
    if (mounted) {
      const state: WorkspaceState = { tabs, activeTabId, layout };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [tabs, activeTabId, layout, mounted]);

  // Get active tab object
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Open a new tab
  const openTab = useCallback((terminalId: string, name: string) => {
    // Check if terminal is already open
    setTabs((prev) => {
      const existing = prev.find((t) => t.terminalId === terminalId);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }

      const newTab: Tab = {
        id: generateId(),
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

      return [...prev, newTab];
    });
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;

      const newTabs = prev.filter((t) => t.id !== tabId);

      // If closing active tab, activate adjacent tab
      if (activeTabId === tabId && newTabs.length > 0) {
        const newActiveIndex = Math.min(index, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex].id);

        // Update layout to show the new active terminal
        setLayout({
          id: generateId(),
          type: 'terminal',
          terminalId: newTabs[newActiveIndex].terminalId,
        });
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
        setLayout(null);
      }

      return newTabs;
    });
  }, [activeTabId]);

  // Set active tab
  const handleSetActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);

    // Update layout to show this terminal
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab) {
        setLayout({
          id: generateId(),
          type: 'terminal',
          terminalId: tab.terminalId,
        });
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
      return newTabs;
    });
  }, []);

  // Update tab name
  const updateTabName = useCallback((tabId: string, name: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, name } : t))
    );
  }, []);

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
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        tabs,
        activeTabId,
        activeTab,
        openTab,
        closeTab,
        setActiveTab: handleSetActiveTab,
        reorderTabs,
        updateTabName,
        layout,
        splitPane,
        closePane,
        updatePaneSizes,
        setSimpleLayout,
        showQuickSwitcher,
        setShowQuickSwitcher,
        clearWorkspace,
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
