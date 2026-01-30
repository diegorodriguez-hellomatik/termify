'use client';

import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  itemType: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  itemName,
  itemType,
  description,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in-95">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X size={18} className="text-muted-foreground" />
        </button>

        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-destructive/10">
            <AlertTriangle size={24} className="text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{itemName}</strong>?
              {description && <span className="block mt-1">{description}</span>}
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete {itemType}
          </Button>
        </div>
      </div>
    </div>
  );
}
