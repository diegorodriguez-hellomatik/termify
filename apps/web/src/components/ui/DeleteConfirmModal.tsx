'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [confirmText, setConfirmText] = useState('');
  const [copied, setCopied] = useState(false);
  const canDelete = confirmText === itemName;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(itemName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (canDelete) {
      onConfirm();
      setConfirmText('');
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  // Reset state when modal closes
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-md z-[111] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">
                {description || `This action cannot be undone.`}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            To confirm deletion, type the {itemType} name below:
          </p>

          {/* Item name with copy button */}
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm truncate">
              {itemName}
            </code>
            <button
              onClick={handleCopy}
              className={cn(
                'p-2 rounded-md transition-colors',
                copied
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
              )}
              title={copied ? 'Copied!' : 'Copy name'}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type ${itemType} name to confirm`}
            className="w-full px-4 py-3 rounded-lg text-sm border border-border bg-background focus:outline-none focus:ring-2 focus:ring-destructive transition-all"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all border border-border hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canDelete}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              canDelete
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Delete {itemType}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
