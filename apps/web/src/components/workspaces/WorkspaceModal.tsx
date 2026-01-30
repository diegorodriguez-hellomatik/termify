'use client';

import { X } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold mb-4">Workspace Options</h2>
        <p className="text-muted-foreground">Select an action for this workspace.</p>
      </div>
    </div>
  );
}
