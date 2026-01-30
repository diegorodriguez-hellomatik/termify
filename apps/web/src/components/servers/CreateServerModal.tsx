'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Server, Key, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { serversApi, Server as ServerType, ServerAuthMethod } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (server: ServerType) => void;
  isDark: boolean;
  token?: string;
}

export function CreateServerModal({
  isOpen,
  onClose,
  onCreated,
  isDark,
  token,
}: CreateServerModalProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<ServerAuthMethod>('PASSWORD');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [documentation, setDocumentation] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setHost('');
    setPort(22);
    setUsername('');
    setAuthMethod('PASSWORD');
    setPassword('');
    setPrivateKey('');
    setDescription('');
    setTags('');
    setDocumentation('');
    setTestResult(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTestConnection = async () => {
    if (!token || !host || !username) return;

    setTesting(true);
    setTestResult(null);
    setError('');

    try {
      const response = await serversApi.testConnection(
        {
          host,
          port,
          username,
          password: authMethod === 'PASSWORD' ? password : undefined,
          privateKey: authMethod === 'KEY' ? privateKey : undefined,
        },
        token
      );

      if (response.success && response.data) {
        setTestResult({
          success: response.data.connected,
          message: response.data.connected
            ? response.data.serverInfo || 'Connection successful!'
            : response.data.error || 'Connection failed',
        });
      } else {
        setTestResult({
          success: false,
          message: 'Failed to test connection',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!token) return;

    setCreating(true);
    setError('');

    try {
      const response = await serversApi.create(
        {
          name: name || `${username}@${host}`,
          host,
          port,
          username,
          authMethod,
          password: authMethod === 'PASSWORD' ? password : undefined,
          privateKey: authMethod === 'KEY' ? privateKey : undefined,
          description: description || undefined,
          documentation: documentation || undefined,
          tags: tags
            ? tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined,
        },
        token
      );

      if (response.success && response.data) {
        onCreated(response.data);
        handleClose();
      } else {
        setError(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to create server'
        );
      }
    } catch (err) {
      setError('Failed to create server');
    } finally {
      setCreating(false);
    }
  };

  const canTest =
    host && username && (authMethod === 'AGENT' || password || privateKey);
  const canCreate = host && username;

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isDark ? 'bg-primary/20' : 'bg-primary/10'
              )}
            >
              <Server size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">New Server</h2>
              <p className="text-sm text-muted-foreground">
                Add a new SSH server connection
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Host and Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">
                Host <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100 or example.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                min={1}
                max={65535}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Username <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Authentication Method
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAuthMethod('PASSWORD')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                  authMethod === 'PASSWORD'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Lock size={16} />
                Password
              </button>
              <button
                onClick={() => setAuthMethod('KEY')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                  authMethod === 'KEY'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Key size={16} />
                Private Key
              </button>
            </div>
          </div>

          {/* Password or Private Key */}
          {authMethod === 'PASSWORD' ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Private Key
              </label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono resize-none"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Production web server"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Tags <span className="text-muted-foreground">(comma separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="production, web, nginx"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                testResult.success
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              {testResult.success ? (
                <CheckCircle size={16} />
              ) : (
                <XCircle size={16} />
              )}
              <span className="line-clamp-2">{testResult.message}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!canTest || testing}
            className="gap-2"
          >
            {testing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Test Connection
              </>
            )}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="gap-2"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Server'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
