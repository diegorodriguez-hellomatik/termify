'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Monitor, Loader2, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { terminalsApi, SharePermission } from '@/lib/api';

interface ShareTerminalWithTeamModalProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (terminalId: string, permission: SharePermission) => Promise<void>;
}

interface Terminal {
  id: string;
  name: string;
  status: string;
  type: string;
}

export function ShareTerminalWithTeamModal({
  teamId,
  open,
  onOpenChange,
  onShare,
}: ShareTerminalWithTeamModalProps) {
  const { data: session } = useSession();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && session?.accessToken) {
      setLoading(true);
      terminalsApi
        .list(session.accessToken)
        .then((response) => {
          if (response.success && response.data) {
            setTerminals(response.data.terminals);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, session?.accessToken]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const filteredTerminals = terminals.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedTerminalId) return;

    setSubmitting(true);
    try {
      await onShare(selectedTerminalId, permission);
      setSelectedTerminalId(null);
      setPermission('VIEW');
      setSearch('');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4">Share Terminal with Team</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Search Terminals</label>
            <Input
              placeholder="Search your terminals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTerminals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? 'No terminals found' : 'No terminals available'}
              </p>
            ) : (
              filteredTerminals.map((terminal) => (
                <div
                  key={terminal.id}
                  onClick={() => setSelectedTerminalId(terminal.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTerminalId === terminal.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{terminal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {terminal.type} • {terminal.status.toLowerCase()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Permission Level</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={permission === 'VIEW' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPermission('VIEW')}
                className="flex-1 gap-2"
              >
                <Eye size={14} />
                View Only
              </Button>
              <Button
                type="button"
                variant={permission === 'CONTROL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPermission('CONTROL')}
                className="flex-1 gap-2"
              >
                <Edit3 size={14} />
                Can Control
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTerminalId || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Share Terminal
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
