'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  X,
  Plus,
  Terminal,
  ChevronDown,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileVideo,
  FileCog,
  Minimize,
  Maximize,
  LayoutGrid,
  Pencil,
} from 'lucide-react';
import { useWorkspace, Tab } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

// Get icon for file based on extension
function getFileIcon(extension?: string) {
  switch (extension) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'php':
    case 'swift':
    case 'kt':
    case 'scala':
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'css':
    case 'scss':
    case 'html':
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
    case 'csv':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
      return FileImage;
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
    case 'mkv':
      return FileVideo;
    case 'gitignore':
    case 'env':
    case 'dockerignore':
    case 'editorconfig':
      return FileCog;
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
    case 'sass':
      return 'text-pink-500';
    case 'html':
      return 'text-orange-500';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return 'text-purple-500';
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  isDark: boolean;
  isCompact?: boolean;
}

function SortableTab({
  tab,
  isActive,
  onActivate,
  onClose,
  onContextMenu,
  onStartRename,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  isDark,
  isCompact,
}: TabItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tab.id,
    data: {
      type: 'tab',
      tabId: tab.id,
      terminalId: tab.terminalId,
      tabType: tab.type,
      name: tab.name,
    },
    disabled: isRenaming,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : isActive ? 10 : 1,
  };

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Determine icon based on tab type
  const Icon = tab.type === 'file' ? getFileIcon(tab.fileExtension) : Terminal;
  const iconColor = tab.type === 'file' ? getFileIconColor(tab.fileExtension) : 'text-muted-foreground';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onRenameSubmit();
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1.5 rounded-t-lg border-b-2 cursor-pointer transition-all',
        isCompact ? 'px-2 py-0.5 min-w-[80px] max-w-[150px]' : 'px-3 py-1.5 min-w-[120px] max-w-[200px]',
        isActive
          ? 'bg-background border-primary'
          : 'bg-muted/50 border-transparent hover:bg-muted',
        isDragging && 'shadow-lg'
      )}
      onClick={isRenaming ? undefined : onActivate}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (tab.type === 'terminal') {
          onStartRename();
        }
      }}
      onContextMenu={onContextMenu}
      {...(isRenaming ? {} : attributes)}
      {...(isRenaming ? {} : listeners)}
    >
      <Icon size={isCompact ? 12 : 14} className={cn('flex-shrink-0', iconColor)} />
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onRenameSubmit}
          className={cn(
            'flex-1 min-w-0 bg-transparent border-none outline-none font-medium',
            isCompact ? 'text-xs' : 'text-sm'
          )}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={cn(
          'font-medium truncate flex-1',
          isCompact ? 'text-xs' : 'text-sm'
        )}>{tab.name}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          'p-0.5 rounded hover:bg-destructive/20 transition-colors flex-shrink-0',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <X size={isCompact ? 10 : 12} className="text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

interface TabBarProps {
  onAddTab: () => void;
  isDark: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onAutoLayout?: () => void;
}

export function TabBar({ onAddTab, isDark, isFullscreen, onToggleFullscreen, onAutoLayout }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab, renameTerminal } = useWorkspace();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  // Rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleStartRename = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.type === 'terminal') {
      setRenameValue(tab.name);
      setRenamingTabId(tabId);
    }
    closeContextMenu();
  }, [tabs, closeContextMenu]);

  const handleRenameSubmit = useCallback(async () => {
    if (renamingTabId && renameValue.trim()) {
      const tab = tabs.find(t => t.id === renamingTabId);
      if (tab?.terminalId) {
        await renameTerminal(tab.terminalId, renameValue.trim());
      }
    }
    setRenamingTabId(null);
    setRenameValue('');
  }, [renamingTabId, renameValue, tabs, renameTerminal]);

  const handleRenameCancel = useCallback(() => {
    setRenamingTabId(null);
    setRenameValue('');
  }, []);

  const handleCloseTab = useCallback(() => {
    if (contextMenu) {
      closeTab(contextMenu.tabId);
      closeContextMenu();
    }
  }, [contextMenu, closeTab, closeContextMenu]);

  const handleCloseToRight = useCallback(() => {
    if (contextMenu) {
      const index = tabs.findIndex(t => t.id === contextMenu.tabId);
      if (index !== -1) {
        const tabsToClose = tabs.slice(index + 1);
        tabsToClose.forEach(t => closeTab(t.id));
      }
      closeContextMenu();
    }
  }, [contextMenu, tabs, closeTab, closeContextMenu]);

  const handleCloseToLeft = useCallback(() => {
    if (contextMenu) {
      const index = tabs.findIndex(t => t.id === contextMenu.tabId);
      if (index !== -1) {
        const tabsToClose = tabs.slice(0, index);
        tabsToClose.forEach(t => closeTab(t.id));
      }
      closeContextMenu();
    }
  }, [contextMenu, tabs, closeTab, closeContextMenu]);

  const handleCloseOthers = useCallback(() => {
    if (contextMenu) {
      const tabsToClose = tabs.filter(t => t.id !== contextMenu.tabId);
      tabsToClose.forEach(t => closeTab(t.id));
      closeContextMenu();
    }
  }, [contextMenu, tabs, closeTab, closeContextMenu]);

  const handleCloseAll = useCallback(() => {
    tabs.forEach(t => closeTab(t.id));
    closeContextMenu();
  }, [tabs, closeTab, closeContextMenu]);

  if (tabs.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-2 border-b border-border",
          isFullscreen ? "py-0.5" : "py-1"
        )}
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
      >
        <button
          onClick={onAddTab}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Plus size={14} />
          Open Terminal
        </button>

        {/* Exit fullscreen button */}
        {isFullscreen && onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            title="Exit Fullscreen (Esc)"
          >
            <Minimize size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 border-b border-border overflow-x-auto",
        isFullscreen ? "py-0.5" : "py-1"
      )}
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
    >
      <SortableContext
        items={tabs.map((t) => t.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className={cn("flex items-center", isFullscreen ? "gap-0.5" : "gap-1")}>
          {tabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onStartRename={() => handleStartRename(tab.id)}
              isRenaming={renamingTabId === tab.id}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
              isDark={isDark}
              isCompact={isFullscreen}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add new tab button */}
      <button
        onClick={onAddTab}
        className="p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0"
        title="Open new terminal"
      >
        <Plus size={16} className="text-muted-foreground" />
      </button>

      {/* Spacer to push buttons to the right */}
      <div className="flex-1" />

      {/* Auto layout button */}
      {onAutoLayout && (
        <button
          onClick={onAutoLayout}
          className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
          title="Auto Layout (reorganize terminals)"
        >
          <LayoutGrid size={14} className="text-muted-foreground" />
        </button>
      )}

      {/* Fullscreen toggle button - always visible */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen (F11)"}
        >
          {isFullscreen ? (
            <Minimize size={14} className="text-muted-foreground" />
          ) : (
            <Maximize size={14} className="text-muted-foreground" />
          )}
        </button>
      )}

      {/* Context Menu */}
      {contextMenu && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          {/* Menu */}
          <div
            className="fixed z-[9999] min-w-[180px] py-1 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in duration-75"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            {/* Rename - only for terminal tabs */}
            {tabs.find(t => t.id === contextMenu.tabId)?.type === 'terminal' && (
              <>
                <button
                  onClick={() => handleStartRename(contextMenu.tabId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
                >
                  <Pencil size={14} className="text-muted-foreground" />
                  Rename
                </button>
                <div className="my-1 border-t border-border" />
              </>
            )}
            <button
              onClick={handleCloseTab}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
            >
              Close
            </button>
            <button
              onClick={handleCloseToRight}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
            >
              Close to the Right
            </button>
            <button
              onClick={handleCloseToLeft}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
            >
              Close to the Left
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={handleCloseOthers}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors duration-75"
            >
              Close Others
            </button>
            <button
              onClick={handleCloseAll}
              className="w-full px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors duration-75"
            >
              Close All
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
