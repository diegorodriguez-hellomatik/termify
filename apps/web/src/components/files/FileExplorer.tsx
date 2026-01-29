'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileCog,
  RefreshCw,
  Home,
  ChevronUp,
  Loader2,
  AlertCircle,
  Download,
  Copy,
  Trash2,
  Pencil,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: string | null;
  extension: string | null;
}

interface FilesResponse {
  path: string;
  relativePath: string;
  parentPath: string;
  canGoUp: boolean;
  files: FileEntry[];
}

interface FileExplorerProps {
  terminalId: string;
  onFileSelect?: (file: FileEntry) => void;
  onDirectoryChange?: (path: string) => void;
  className?: string;
}

// Custom event for file selection (can be listened to by terminal page)
export function dispatchFileOpen(terminalId: string, file: FileEntry) {
  window.dispatchEvent(new CustomEvent('file-open', {
    detail: { terminalId, file }
  }));
}

// Get icon for file based on extension
function getFileIcon(extension: string | null, isDirectory: boolean) {
  if (isDirectory) return Folder;

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
    case 'hpp':
    case 'php':
    case 'swift':
    case 'kt':
    case 'scala':
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
      return FileImage;
    case 'gitignore':
    case 'env':
    case 'dockerignore':
    case 'editorconfig':
      return FileCog;
    default:
      return File;
  }
}

// Get color for file icon
function getFileColor(extension: string | null, isDirectory: boolean): string {
  if (isDirectory) return 'text-yellow-500';

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
      return 'text-purple-500';
    default:
      return 'text-muted-foreground';
  }
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  entry: FileEntry | null;
}

interface TreeItemProps {
  entry: FileEntry;
  level: number;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  children?: React.ReactNode;
}

function TreeItem({ entry, level, expanded, onToggle, onSelect, onContextMenu, children }: TreeItemProps) {
  const Icon = getFileIcon(entry.extension, entry.isDirectory);
  const iconColor = getFileColor(entry.extension, entry.isDirectory);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-2 hover:bg-muted/50 cursor-pointer rounded-sm text-sm',
          'transition-colors group'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (entry.isDirectory) {
            onToggle();
          } else {
            onSelect();
          }
        }}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {entry.isDirectory ? (
          <button className="p-0.5 -ml-1 hover:bg-muted rounded" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {entry.isDirectory && expanded ? (
          <FolderOpen className={cn('h-4 w-4', iconColor)} />
        ) : (
          <Icon className={cn('h-4 w-4', iconColor)} />
        )}
        <span className="truncate flex-1 text-foreground/90">{entry.name}</span>
        <button
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, entry);
          }}
        >
          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      {expanded && children}
    </div>
  );
}

export function FileExplorer({ terminalId, onFileSelect, onDirectoryChange, className }: FileExplorerProps) {
  const { data: session } = useSession();
  const { openFileTab } = useWorkspace();
  const [filesData, setFilesData] = useState<FilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, FileEntry[]>>({});
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, entry: null });
  const [renaming, setRenaming] = useState<{ entry: FileEntry; newName: string } | null>(null);

  const fetchFiles = useCallback(async (dirPath: string = '.') => {
    if (!session?.accessToken) return null;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${apiUrl}/api/terminals/${terminalId}/files?path=${encodeURIComponent(dirPath)}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const data = await response.json();
    return data.data as FilesResponse;
  }, [terminalId, session?.accessToken]);

  const loadRootDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFiles('.');
      setFilesData(data);
    } catch (err) {
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [fetchFiles]);

  useEffect(() => {
    loadRootDirectory();
  }, [loadRootDirectory]);

  // Listen for file change events from terminal
  useEffect(() => {
    const handleFilesChanged = (event: CustomEvent<{ terminalId: string }>) => {
      if (event.detail.terminalId === terminalId) {
        console.log('[FileExplorer] Files changed, refreshing...');
        // Refresh current directory and clear cache
        setChildrenCache({});
        loadRootDirectory();
      }
    };

    window.addEventListener('terminal-files-changed', handleFilesChanged as EventListener);
    return () => {
      window.removeEventListener('terminal-files-changed', handleFilesChanged as EventListener);
    };
  }, [terminalId, loadRootDirectory]);

  const toggleDirectory = async (entry: FileEntry) => {
    const isExpanded = expandedDirs.has(entry.path);

    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedDirs);
      newExpanded.delete(entry.path);
      setExpandedDirs(newExpanded);
    } else {
      // Expand - load children if not cached
      if (!childrenCache[entry.path]) {
        setLoadingDirs((prev) => new Set(prev).add(entry.path));
        try {
          const data = await fetchFiles(entry.path);
          if (data) {
            setChildrenCache((prev) => ({ ...prev, [entry.path]: data.files }));
          }
        } catch (err) {
          console.error('Failed to load directory:', err);
        } finally {
          setLoadingDirs((prev) => {
            const newSet = new Set(prev);
            newSet.delete(entry.path);
            return newSet;
          });
        }
      }
      setExpandedDirs((prev) => new Set(prev).add(entry.path));
    }
  };

  const navigateUp = async () => {
    if (!filesData?.canGoUp) return;
    setLoading(true);
    try {
      const data = await fetchFiles(filesData.parentPath);
      setFilesData(data);
      setExpandedDirs(new Set());
      setChildrenCache({});
      onDirectoryChange?.(filesData.parentPath);
    } catch (err) {
      setError('Failed to navigate up');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const data = await fetchFiles(dirPath);
      setFilesData(data);
      setExpandedDirs(new Set());
      setChildrenCache({});
      onDirectoryChange?.(dirPath);
    } catch (err) {
      setError('Failed to navigate');
    } finally {
      setLoading(false);
    }
  }, [fetchFiles, onDirectoryChange]);

  // Listen for CWD changes from terminal to sync file explorer
  useEffect(() => {
    const handleCwdChanged = (event: CustomEvent<{ terminalId: string; cwd: string }>) => {
      if (event.detail.terminalId === terminalId) {
        console.log('[FileExplorer] CWD changed, navigating to:', event.detail.cwd);
        navigateToPath(event.detail.cwd);
      }
    };

    window.addEventListener('terminal-cwd-changed', handleCwdChanged as EventListener);
    return () => {
      window.removeEventListener('terminal-cwd-changed', handleCwdChanged as EventListener);
    };
  }, [terminalId, navigateToPath]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu({ visible: false, x: 0, y: 0, entry: null });
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entry,
    });
  }, []);

  const handleDownload = useCallback(async () => {
    if (!contextMenu.entry || !session?.accessToken) return;
    const entry = contextMenu.entry;
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/terminals/${terminalId}/files/download?path=${encodeURIComponent(entry.path)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  }, [contextMenu.entry, session?.accessToken, terminalId]);

  const handleCopyPath = useCallback(() => {
    if (!contextMenu.entry) return;
    navigator.clipboard.writeText(contextMenu.entry.path);
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });
  }, [contextMenu.entry]);

  const handleDelete = useCallback(async () => {
    if (!contextMenu.entry || !session?.accessToken) return;
    const entry = contextMenu.entry;
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });

    const confirmed = window.confirm(`Are you sure you want to delete "${entry.name}"?`);
    if (!confirmed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/terminals/${terminalId}/files?path=${encodeURIComponent(entry.path)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Delete failed');

      // Refresh file list
      setChildrenCache({});
      loadRootDirectory();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  }, [contextMenu.entry, session?.accessToken, terminalId, loadRootDirectory]);

  const handleStartRename = useCallback(() => {
    if (!contextMenu.entry) return;
    setRenaming({ entry: contextMenu.entry, newName: contextMenu.entry.name });
    setContextMenu({ visible: false, x: 0, y: 0, entry: null });
  }, [contextMenu.entry]);

  const handleRename = useCallback(async () => {
    if (!renaming || !session?.accessToken) return;
    const { entry, newName } = renaming;

    if (newName === entry.name || !newName.trim()) {
      setRenaming(null);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/terminals/${terminalId}/files/rename`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            oldPath: entry.path,
            newName: newName.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error('Rename failed');

      // Refresh file list
      setChildrenCache({});
      loadRootDirectory();
    } catch (err) {
      console.error('Failed to rename file:', err);
    } finally {
      setRenaming(null);
    }
  }, [renaming, session?.accessToken, terminalId, loadRootDirectory]);

  const renderEntries = (entries: FileEntry[], level: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path);
      const isLoading = loadingDirs.has(entry.path);
      const children = childrenCache[entry.path];

      // Handle renaming state
      if (renaming && renaming.entry.path === entry.path) {
        return (
          <div
            key={entry.path}
            className="flex items-center gap-1 py-0.5 px-2"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            <span className="w-4" />
            <input
              type="text"
              value={renaming.newName}
              onChange={(e) => setRenaming({ ...renaming, newName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setRenaming(null);
              }}
              onBlur={handleRename}
              className="flex-1 px-1 py-0.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        );
      }

      return (
        <TreeItem
          key={entry.path}
          entry={entry}
          level={level}
          expanded={isExpanded}
          onToggle={() => toggleDirectory(entry)}
          onSelect={() => {
            onFileSelect?.(entry);
            // Open file in a new tab
            if (!entry.isDirectory) {
              openFileTab(entry.path, entry.name, entry.extension || undefined);
              // Dispatch event for Terminal Page to listen
              dispatchFileOpen(terminalId, entry);
            }
          }}
          onContextMenu={handleContextMenu}
        >
          {entry.isDirectory && isExpanded && (
            <>
              {isLoading ? (
                <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}>
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : children && children.length > 0 ? (
                renderEntries(children, level + 1)
              ) : (
                <div
                  className="text-xs text-muted-foreground py-1"
                  style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}
                >
                  Empty directory
                </div>
              )}
            </>
          )}
        </TreeItem>
      );
    });
  };

  if (loading && !filesData) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 px-4 text-center', className)}>
        <AlertCircle className="h-5 w-5 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={loadRootDirectory}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
        <button
          onClick={navigateUp}
          disabled={!filesData?.canGoUp || loading}
          className={cn(
            'p-1 rounded hover:bg-muted transition-colors',
            (!filesData?.canGoUp || loading) && 'opacity-50 cursor-not-allowed'
          )}
          title="Go up"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigateToPath('~')}
          disabled={loading}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Home directory"
        >
          <Home className="h-4 w-4" />
        </button>
        <button
          onClick={loadRootDirectory}
          disabled={loading}
          className="p-1 rounded hover:bg-muted transition-colors ml-auto"
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Current path */}
      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border truncate">
        {filesData?.relativePath || filesData?.path || '~'}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto py-1">
        {filesData?.files && filesData.files.length > 0 ? (
          renderEntries(filesData.files)
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            No files found
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.entry && (
        <div
          className="fixed z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
            onClick={handleCopyPath}
          >
            <Copy className="h-4 w-4" />
            Copy Path
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
            onClick={handleStartRename}
          >
            <Pencil className="h-4 w-4" />
            Rename
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
