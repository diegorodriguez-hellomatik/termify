'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Server, Key, Lock, Loader2, CheckCircle, XCircle, Activity, ChevronDown, ChevronRight, Info, Copy, Terminal } from 'lucide-react';
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

  // Stats Agent section
  const [statsAgentExpanded, setStatsAgentExpanded] = useState(false);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{
    checked: boolean;
    installed: boolean;
    version?: string;
    error?: string;
  } | null>(null);
  const [installingAgent, setInstallingAgent] = useState(false);
  const [installResult, setInstallResult] = useState<{
    success: boolean;
    message: string;
    instructions?: string[];
  } | null>(null);

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
    setStatsAgentExpanded(false);
    setAgentStatus(null);
    setInstallResult(null);
  };

  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  const handleCheckStatsAgent = async () => {
    if (!token || !host || !username) return;

    setCheckingAgent(true);
    setAgentStatus(null);
    setInstallResult(null);

    try {
      const response = await serversApi.checkStatsAgent(
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
        setAgentStatus({
          checked: true,
          installed: response.data.installed,
          version: response.data.version,
          error: response.data.connected ? undefined : response.data.error,
        });
      } else {
        setAgentStatus({
          checked: true,
          installed: false,
          error: 'Failed to check stats-agent',
        });
      }
    } catch {
      setAgentStatus({
        checked: true,
        installed: false,
        error: 'Failed to check stats-agent',
      });
    } finally {
      setCheckingAgent(false);
    }
  };

  const handleInstallStatsAgent = async () => {
    if (!token || !host || !username) return;

    setInstallingAgent(true);
    setInstallResult(null);

    try {
      const response = await serversApi.installStatsAgent(
        {
          host,
          port,
          username,
          password: authMethod === 'PASSWORD' ? password : undefined,
          privateKey: authMethod === 'KEY' ? privateKey : undefined,
        },
        token
      );

      if (response.success && response.data?.installed) {
        setInstallResult({
          success: true,
          message: `Stats agent installed successfully! Version: ${response.data.version}`,
        });
        setAgentStatus({
          checked: true,
          installed: true,
          version: response.data.version,
        });
      } else {
        // Get error message from response
        const errorMsg = (response as { error?: string }).error || 'Installation failed';
        setInstallResult({
          success: false,
          message: errorMsg,
          instructions: response.data?.instructions,
        });
      }
    } catch {
      setInstallResult({
        success: false,
        message: 'Failed to install stats-agent',
      });
    } finally {
      setInstallingAgent(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
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

          {/* Stats Agent Section - Only show for remote servers */}
          {!isLocalhost && (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header - Collapsible */}
              <button
                type="button"
                onClick={() => setStatsAgentExpanded(!statsAgentExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  <span className="text-sm font-medium">Server Monitoring</span>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                {statsAgentExpanded ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
              </button>

              {/* Expanded Content */}
              {statsAgentExpanded && (
                <div className="p-3 pt-0 space-y-3 border-t border-border">
                  {/* Info */}
                  <div className="flex gap-2 p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium mb-1">Stats Agent for Real-Time Monitoring</p>
                      <p className="text-muted-foreground">
                        Install the stats-agent on your server to enable real-time CPU, memory, disk, and network monitoring.
                        The agent runs as a lightweight daemon and streams metrics every 5 seconds.
                      </p>
                    </div>
                  </div>

                  {/* Check Button */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCheckStatsAgent}
                      disabled={!canTest || checkingAgent}
                      className="gap-2"
                    >
                      {checkingAgent ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Terminal size={14} />
                          Check if Installed
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Agent Status */}
                  {agentStatus && (
                    <div
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg text-sm',
                        agentStatus.installed
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : agentStatus.error
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      )}
                    >
                      {agentStatus.installed ? (
                        <>
                          <CheckCircle size={14} />
                          <span>Stats agent installed: {agentStatus.version}</span>
                        </>
                      ) : agentStatus.error ? (
                        <>
                          <XCircle size={14} />
                          <span>{agentStatus.error}</span>
                        </>
                      ) : (
                        <>
                          <Info size={14} />
                          <span>Stats agent not installed on this server</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Install Button - Only show if not installed */}
                  {agentStatus && !agentStatus.installed && !agentStatus.error && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleInstallStatsAgent}
                        disabled={installingAgent}
                        className="gap-2"
                      >
                        {installingAgent ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <Activity size={14} />
                            Install Stats Agent
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Install Result */}
                  {installResult && (
                    <div
                      className={cn(
                        'p-2 rounded-lg text-sm',
                        installResult.success
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {installResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        <span>{installResult.message}</span>
                      </div>

                      {/* Manual Instructions if auto-install failed */}
                      {installResult.instructions && (
                        <div className="mt-2 p-2 rounded bg-background border border-border">
                          <p className="text-xs font-medium mb-2 text-foreground">Manual Installation:</p>
                          <div className="space-y-1">
                            {installResult.instructions.map((instruction, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-xs font-mono text-muted-foreground"
                              >
                                <span className="whitespace-pre-wrap">{instruction}</span>
                                {instruction.startsWith('   ') && (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(instruction.trim())}
                                    className="shrink-0 p-1 hover:bg-muted rounded"
                                    title="Copy command"
                                  >
                                    <Copy size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
