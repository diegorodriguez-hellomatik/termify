'use client';

import { useState } from 'react';
import { Loader2, Terminal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CreateTeamTerminalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    type?: 'LOCAL' | 'SSH';
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
  }) => Promise<any>;
}

export function CreateTeamTerminalModal({
  open,
  onOpenChange,
  onCreate,
}: CreateTeamTerminalModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'LOCAL' | 'SSH'>('LOCAL');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (type === 'SSH') {
      if (!sshHost.trim()) {
        setError('Host is required for SSH');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const data: any = { name: name.trim(), type };
      if (type === 'SSH') {
        data.sshHost = sshHost.trim();
        data.sshPort = parseInt(sshPort, 10) || 22;
        if (sshUsername.trim()) {
          data.sshUsername = sshUsername.trim();
        }
      }

      const result = await onCreate(data);
      if (result.success) {
        handleClose();
      } else {
        setError(result.error || 'Failed to create terminal');
      }
    } catch (err) {
      setError('Failed to create terminal');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('LOCAL');
    setSshHost('');
    setSshPort('22');
    setSshUsername('');
    setError('');
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold mb-4">Create Team Terminal</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Terminal Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Server"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                  type === 'LOCAL'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => setType('LOCAL')}
                disabled={loading}
              >
                <Terminal className="h-5 w-5" />
                <span className="font-medium">Local</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors',
                  type === 'SSH'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                )}
                onClick={() => setType('SSH')}
                disabled={loading}
              >
                <Server className="h-5 w-5" />
                <span className="font-medium">SSH</span>
              </button>
            </div>
          </div>

          {type === 'SSH' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Host</label>
                <Input
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Port
                  </label>
                  <Input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    placeholder="22"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Username
                  </label>
                  <Input
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="root"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Terminal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
