'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  Clock,
  Activity,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apikeysApi, ApiKey } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const { isDark } = useTheme();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write']);
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | undefined>(undefined);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const response = await apikeysApi.list(session.accessToken);
      if (response.success && response.data) {
        setApiKeys(response.data.apiKeys);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreateKey = async () => {
    if (!session?.accessToken || !newKeyName.trim()) return;

    setCreating(true);
    try {
      const response = await apikeysApi.create(
        {
          name: newKeyName.trim(),
          permissions: newKeyPermissions,
          expiresIn: newKeyExpiry,
        },
        session.accessToken
      );

      if (response.success && response.data) {
        setNewlyCreatedKey(response.data.apiKey.key || null);
        setApiKeys([response.data.apiKey, ...apiKeys]);
        setNewKeyName('');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      const response = await apikeysApi.revoke(id, session.accessToken);
      if (response.success) {
        setApiKeys(apiKeys.filter((k) => k.id !== id));
      }
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            API Keys
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for programmatic access to Claude Terminal
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/docs/api">
            <Button variant="outline" className="gap-2">
              <ExternalLink size={16} />
              API Documentation
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus size={16} />
            Create API Key
          </Button>
        </div>
      </div>

      {/* Newly Created Key Alert */}
      {newlyCreatedKey && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
                  Save your API key now!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This is the only time you'll see this key. Copy it and store it securely.
                </p>
                <div className="flex items-center gap-2 p-3 bg-card border rounded-lg font-mono text-sm">
                  <code className="flex-1 break-all">{newlyCreatedKey}</code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey, 'new-key')}
                    className="p-2 hover:bg-muted rounded transition-colors"
                  >
                    {copiedId === 'new-key' ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setNewlyCreatedKey(null)}
                >
                  I've saved the key
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Key Modal */}
      {showCreateModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <Card className="relative w-full max-w-md z-10">
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
              <CardDescription>
                Generate a new API key for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My API Key"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  A descriptive name to identify this key
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {['read', 'write', 'admin'].map((perm) => (
                    <button
                      key={perm}
                      onClick={() => {
                        if (newKeyPermissions.includes(perm)) {
                          setNewKeyPermissions(newKeyPermissions.filter((p) => p !== perm));
                        } else {
                          setNewKeyPermissions([...newKeyPermissions, perm]);
                        }
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize',
                        newKeyPermissions.includes(perm)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Expiration (optional)</label>
                <select
                  value={newKeyExpiry || ''}
                  onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="">Never expires</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
              <p className="text-muted-foreground mb-6">
                Create an API key to start using the Claude Terminal API
              </p>
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus size={16} />
                Create your first API key
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Key size={20} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{key.name}</h4>
                        <div className="flex gap-1">
                          {key.permissions.map((perm) => (
                            <span
                              key={perm}
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                perm === 'admin'
                                  ? 'bg-red-500/10 text-red-500'
                                  : perm === 'write'
                                  ? 'bg-yellow-500/10 text-yellow-600'
                                  : 'bg-green-500/10 text-green-600'
                              )}
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="font-mono">{key.keyPrefix}•••••••••</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Created {formatDate(key.createdAt)}
                        </span>
                        {key.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Activity size={12} />
                            Last used {formatDate(key.lastUsedAt)}
                          </span>
                        )}
                        {key.expiresAt && (
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Expires {formatDate(key.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeKey(key.id)}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Reference */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Quick Reference</CardTitle>
              <CardDescription>
                How to use your API key
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Authentication Header</h4>
              <pre className="p-3 bg-muted rounded-lg text-sm font-mono overflow-x-auto">
                Authorization: Bearer ct_live_your_api_key_here
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Example Request (cURL)</h4>
              <pre className="p-3 bg-muted rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -X GET https://api.claudeterminal.com/api/terminals \\
  -H "Authorization: Bearer ct_live_your_api_key_here" \\
  -H "Content-Type: application/json"`}
              </pre>
            </div>
            <div className="pt-4">
              <Link href="/docs/api">
                <Button variant="outline" className="gap-2">
                  <ExternalLink size={16} />
                  View Full API Documentation
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
