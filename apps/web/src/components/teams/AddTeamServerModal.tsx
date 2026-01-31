'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Key, Lock, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamServer, ServerAuthMethod } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AddTeamServerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    host: string;
    port?: number;
    username?: string;
    authMethod?: ServerAuthMethod;
    description?: string;
    tags?: string[];
  }) => Promise<{ success: boolean; data?: TeamServer; error?: string | unknown[] }>;
  editingServer?: TeamServer | null;
  onUpdate?: (id: string, data: {
    name?: string;
    host?: string;
    port?: number;
    username?: string | null;
    authMethod?: ServerAuthMethod;
    description?: string | null;
    tags?: string[];
  }) => Promise<{ success: boolean; error?: string | unknown[] }>;
}

const AUTH_METHODS: { value: ServerAuthMethod; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'PASSWORD',
    label: 'Password',
    icon: <Lock className="h-4 w-4" />,
    description: 'Authenticate with username and password'
  },
  {
    value: 'KEY',
    label: 'SSH Key',
    icon: <Key className="h-4 w-4" />,
    description: 'Use SSH key from your system'
  },
  {
    value: 'AGENT',
    label: 'SSH Agent',
    icon: <UserCircle className="h-4 w-4" />,
    description: 'Use system SSH agent'
  },
];

export function AddTeamServerModal({
  open,
  onOpenChange,
  onCreate,
  editingServer,
  onUpdate,
}: AddTeamServerModalProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<ServerAuthMethod>('KEY');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (editingServer) {
      setName(editingServer.name);
      setHost(editingServer.host);
      setPort(String(editingServer.port));
      setUsername(editingServer.username || '');
      setAuthMethod(editingServer.authMethod);
      setDescription(editingServer.description || '');
      setTagsInput(editingServer.tags?.join(', ') || '');
    } else {
      setName('');
      setHost('');
      setPort('22');
      setUsername('');
      setAuthMethod('KEY');
      setDescription('');
      setTagsInput('');
    }
  }, [editingServer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }
    if (!host.trim()) {
      setError('Host is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const portNumber = parseInt(port, 10) || 22;

      if (editingServer && onUpdate) {
        const result = await onUpdate(editingServer.id, {
          name: name.trim(),
          host: host.trim(),
          port: portNumber,
          username: username.trim() || null,
          authMethod,
          description: description.trim() || null,
          tags,
        });
        if (result.success) {
          handleClose();
        } else {
          const errMsg = Array.isArray(result.error) ? result.error.join(', ') : result.error;
          setError(errMsg || 'Failed to update server');
        }
      } else {
        const result = await onCreate({
          name: name.trim(),
          host: host.trim(),
          port: portNumber,
          username: username.trim() || undefined,
          authMethod,
          description: description.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });
        if (result.success) {
          handleClose();
        } else {
          const errMsg = Array.isArray(result.error) ? result.error.join(', ') : result.error;
          setError(errMsg || 'Failed to add server');
        }
      }
    } catch (err) {
      setError('Failed to save server');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setHost('');
    setPort('22');
    setUsername('');
    setAuthMethod('KEY');
    setDescription('');
    setTagsInput('');
    setError('');
    onOpenChange(false);
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-lg p-6 z-[101] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold mb-4">
          {editingServer ? 'Edit Server' : 'Add Team Server'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Server Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Server"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Host</label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100 or server.example.com"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Port</label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Username (optional)
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Authentication Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AUTH_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors text-center',
                    authMethod === method.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  )}
                  onClick={() => setAuthMethod(method.value)}
                  disabled={loading}
                >
                  {method.icon}
                  <span className="text-xs font-medium">{method.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {AUTH_METHODS.find((m) => m.value === authMethod)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Main production server for API"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Tags (optional)
            </label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="production, api, linux"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate with commas
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !host.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingServer ? 'Save Changes' : 'Add Server'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
