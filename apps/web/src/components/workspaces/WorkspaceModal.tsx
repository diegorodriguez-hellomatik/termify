'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Layers,
  Star,
  Trash2,
  Edit2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Workspace } from '@/lib/api';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: () => void;
  onEditWorkspace: (workspace: Workspace) => void;
}

export function WorkspaceModal({
  isOpen,
  onClose,
  onCreateWorkspace,
  onEditWorkspace,
}: WorkspaceModalProps) {
  const {
    workspaces,
    currentWorkspaceId,
    switchWorkspace,
    deleteWorkspace,
    updateWorkspace,
  } = useWorkspace();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  // Get workspace display color
  const getWorkspaceColor = (workspace: Workspace) => {
    return workspace.color || '#6366f1';
  };

  // Get workspace icon
  const getWorkspaceIcon = (workspace: Workspace) => {
    if (workspace.icon) {
      return <span className="text-lg">{workspace.icon}</span>;
    }
    return <Layers className="h-5 w-5" />;
  };

  // Handle delete
  const handleDelete = async (workspace: Workspace) => {
    if (confirmDelete !== workspace.id) {
      setConfirmDelete(workspace.id);
      return;
    }

    setDeletingId(workspace.id);
    try {
      await deleteWorkspace(workspace.id);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  // Handle set as default
  const handleSetDefault = async (workspace: Workspace) => {
    if (workspace.isDefault) return;
    await updateWorkspace(workspace.id, { isDefault: true });
  };

  // Handle select workspace
  const handleSelect = async (workspace: Workspace) => {
    await switchWorkspace(workspace.id);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Workspaces</h2>
            <p className="text-sm text-muted-foreground">
              Manage your workspaces and organize terminals
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {workspaces.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No workspaces yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first workspace to organize your terminals
              </p>
              <button
                onClick={onCreateWorkspace}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Create workspace
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={cn(
                    'group relative flex items-center gap-4 p-4 rounded-lg border transition-all',
                    workspace.id === currentWorkspaceId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                  )}
                >
                  {/* Drag handle */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getWorkspaceColor(workspace) + '20' }}
                  >
                    <div style={{ color: getWorkspaceColor(workspace) }}>
                      {getWorkspaceIcon(workspace)}
                    </div>
                  </div>

                  {/* Info */}
                  <button
                    onClick={() => handleSelect(workspace)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{workspace.name}</p>
                      {workspace.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          default
                        </span>
                      )}
                      {workspace.id === currentWorkspaceId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">
                          active
                        </span>
                      )}
                    </div>
                    {workspace.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {workspace.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {workspace.terminalCount || 0} terminal{(workspace.terminalCount || 0) !== 1 ? 's' : ''}
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!workspace.isDefault && (
                      <button
                        onClick={() => handleSetDefault(workspace)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onEditWorkspace(workspace)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit workspace"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        onClick={() => handleDelete(workspace)}
                        disabled={deletingId === workspace.id}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          confirmDelete === workspace.id
                            ? 'bg-destructive text-destructive-foreground'
                            : 'hover:bg-muted text-muted-foreground hover:text-destructive'
                        )}
                        title={confirmDelete === workspace.id ? 'Click again to confirm' : 'Delete workspace'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onCreateWorkspace}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Create new workspace
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
