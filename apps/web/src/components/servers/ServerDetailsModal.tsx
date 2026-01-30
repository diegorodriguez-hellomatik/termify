'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  Server,
  Play,
  Trash2,
  Pencil,
  Key,
  Lock,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  Tag,
  FileText,
  History,
  RefreshCw,
  Wifi,
  WifiOff,
  Terminal,
  Square,
  ExternalLink,
} from 'lucide-react';
import {
  serversApi,
  Server as ServerType,
  ServerDetails,
  ServerAuthMethod,
  ServerStatus,
  ActiveServerTerminal,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';

interface ServerDetailsModalProps {
  server: ServerType;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdated: (server: ServerType) => void;
  isDark: boolean;
  token?: string;
}

const STATUS_COLORS: Record<ServerStatus | 'null', string> = {
  ONLINE: 'bg-green-500',
  OFFLINE: 'bg-red-500',
  UNKNOWN: 'bg-gray-500',
  null: 'bg-gray-500',
};

export function ServerDetailsModal({
  server,
  isOpen,
  onClose,
  onConnect,
  onDelete,
  onUpdated,
  isDark,
  token,
}: ServerDetailsModalProps) {
  const router = useRouter();
  const [details, setDetails] = useState<ServerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'active' | 'connect' | 'history'>('info');

  // Active terminals
  const [activeTerminals, setActiveTerminals] = useState<ActiveServerTerminal[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);
  const [closingTerminal, setClosingTerminal] = useState<string | null>(null);

  // Connect form
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editDescription, setEditDescription] = useState(server.description || '');
  const [editDocumentation, setEditDocumentation] = useState(server.documentation || '');
  const [editTags, setEditTags] = useState(server.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);

  // Check status
  const [checking, setChecking] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      loadDetails();
      loadActiveTerminals();
    }
  }, [isOpen, server.id, token]);

  const loadActiveTerminals = async () => {
    if (!token) return;
    setLoadingTerminals(true);
    try {
      const response = await serversApi.getActiveTerminals(server.id, token);
      if (response.success && response.data) {
        setActiveTerminals(response.data.terminals);
      }
    } catch (error) {
      console.error('Failed to load active terminals:', error);
    } finally {
      setLoadingTerminals(false);
    }
  };

  const handleCloseTerminal = async (terminalId: string) => {
    if (!token) return;
    setClosingTerminal(terminalId);
    try {
      const response = await serversApi.closeTerminal(server.id, terminalId, token);
      if (response.success) {
        setActiveTerminals((prev) => prev.filter((t) => t.id !== terminalId));
      }
    } catch (error) {
      console.error('Failed to close terminal:', error);
    } finally {
      setClosingTerminal(null);
    }
  };

  const handleOpenTerminal = (terminalId: string) => {
    // Navigate to the terminal - but since it's ephemeral, we create a new one
    // For now, just navigate to the server's terminal page
    router.push(`/servers/${server.id}/terminal`);
    onClose();
  };

  const loadDetails = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await serversApi.get(server.id, token);
      if (response.success && response.data) {
        setDetails(response.data);
        setEditName(response.data.name);
        setEditDescription(response.data.description || '');
        setEditDocumentation(response.data.documentation || '');
        setEditTags(response.data.tags?.join(', ') || '');
      }
    } catch (error) {
      console.error('Failed to load server details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!token) return;
    setChecking(true);
    try {
      const response = await serversApi.test(server.id, token);
      if (response.success && response.data) {
        const updated = {
          ...server,
          lastStatus: response.data.status,
          lastCheckedAt: response.data.checkedAt,
        };
        onUpdated(updated);
        if (details) {
          setDetails({
            ...details,
            lastStatus: response.data.status,
            lastCheckedAt: response.data.checkedAt,
          });
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = () => {
    // Navigate to ephemeral terminal page - credentials will be asked there
    router.push(`/servers/${server.id}/terminal`);
    onClose();
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);

    try {
      const response = await serversApi.update(
        server.id,
        {
          name: editName,
          description: editDescription || null,
          documentation: editDocumentation || null,
          tags: editTags
            ? editTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        },
        token
      );

      if (response.success && response.data) {
        onUpdated(response.data);
        if (details) {
          setDetails({
            ...details,
            name: response.data.name,
            description: response.data.description,
            documentation: response.data.documentation,
            tags: response.data.tags,
          });
        }
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete(server.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentServer = details || server;
  const status = currentServer.lastStatus || 'UNKNOWN';

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{currentServer.name}</h2>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    STATUS_COLORS[status as keyof typeof STATUS_COLORS]
                  )}
                />
                {currentServer.isDefault && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {currentServer.host}:{currentServer.port}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'info'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Information
          </button>
          <button
            onClick={() => {
              setActiveTab('active');
              loadActiveTerminals();
            }}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'active'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Active
            {activeTerminals.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                {activeTerminals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'connect'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Connect
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'history'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === 'info' ? (
            <div className="space-y-4">
              {/* Connection Info */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Host</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{currentServer.host}</span>
                    <button
                      onClick={() => copyToClipboard(currentServer.host)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Copy size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Port</span>
                  <span className="text-sm font-mono">{currentServer.port}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Username</span>
                  <span className="text-sm font-mono">
                    {currentServer.username || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Auth Method
                  </span>
                  <span className="text-sm capitalize">
                    {currentServer.authMethod.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        status === 'ONLINE'
                          ? 'text-green-500'
                          : status === 'OFFLINE'
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                      )}
                    >
                      {status}
                    </span>
                    <button
                      onClick={handleCheckStatus}
                      disabled={checking}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <RefreshCw
                        size={14}
                        className={cn(
                          'text-muted-foreground',
                          checking && 'animate-spin'
                        )}
                      />
                    </button>
                  </div>
                </div>
                {currentServer.lastCheckedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Checked
                    </span>
                    <span className="text-sm">
                      {formatRelativeTime(currentServer.lastCheckedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Editable fields */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Documentation / Notes
                    </label>
                    <textarea
                      value={editDocumentation}
                      onChange={(e) => setEditDocumentation(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 gap-2"
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Description */}
                  {currentServer.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground">
                        {currentServer.description}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {currentServer.tags && currentServer.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentServer.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                          >
                            <Tag size={12} />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documentation */}
                  {currentServer.documentation && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">
                        Documentation / Notes
                      </h4>
                      <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                        {currentServer.documentation}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="gap-2"
                    >
                      <Pencil size={16} />
                      Edit
                    </Button>
                    {!currentServer.isDefault && (
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'active' ? (
            /* Active Terminals tab */
            <div className="space-y-3">
              {loadingTerminals ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : activeTerminals.length === 0 ? (
                <div className="text-center py-8">
                  <Terminal size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No active terminals
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect to create a new terminal session
                  </p>
                </div>
              ) : (
                activeTerminals.map((terminal) => (
                  <div
                    key={terminal.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Terminal size={16} className="text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{terminal.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{terminal.type.toLowerCase()}</span>
                          <span>•</span>
                          <span className="text-green-600 dark:text-green-400">
                            {terminal.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCloseTerminal(terminal.id)}
                        disabled={closingTerminal === terminal.id}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors disabled:opacity-50"
                        title="Close terminal"
                      >
                        {closingTerminal === terminal.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* New connection button */}
              <Button
                onClick={handleConnect}
                variant="outline"
                className="w-full mt-4 gap-2"
              >
                <Play size={16} />
                New Terminal
              </Button>
            </div>
          ) : activeTab === 'connect' ? (
            <div className="space-y-4">
              {/* Terminal name */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Terminal Name <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  placeholder={`SSH - ${currentServer.name}`}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {/* Credentials if needed */}
              {currentServer.authMethod === 'PASSWORD' && (
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use stored password
                  </p>
                </div>
              )}

              {currentServer.authMethod === 'KEY' && (
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use stored key
                  </p>
                </div>
              )}

              {/* Error */}
              {connectError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                  <XCircle size={16} />
                  <span>{connectError}</span>
                </div>
              )}

              {/* Connect button */}
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Connect
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* History tab */
            <div className="space-y-3">
              {details?.connections && details.connections.length > 0 ? (
                details.connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {conn.success ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {conn.success ? 'Connected' : 'Failed'}
                        </p>
                        {conn.error && (
                          <p className="text-xs text-muted-foreground">
                            {conn.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(conn.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <History size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No connection history yet
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Delete Server?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete "{currentServer.name}"? This
                action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
