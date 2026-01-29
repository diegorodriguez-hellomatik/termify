'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Terminal, Server, Eye, EyeOff, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { terminalsApi } from '@/lib/api';

interface CreateTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLocal: () => void;
  onCreateSSH: (config: SSHConfig) => void;
  isDark: boolean;
  token?: string;
}

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  name?: string;
}

type TerminalType = 'local' | 'ssh' | null;
type AuthMethod = 'password' | 'key';
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export function CreateTerminalModal({
  isOpen,
  onClose,
  onCreateLocal,
  onCreateSSH,
  isDark,
  token,
}: CreateTerminalModalProps) {
  const [terminalType, setTerminalType] = useState<TerminalType>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [showPassword, setShowPassword] = useState(false);

  // SSH form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [connectionName, setConnectionName] = useState('');

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setTerminalType(null);
    setAuthMethod('password');
    setHost('');
    setPort('22');
    setUsername('');
    setPassword('');
    setPrivateKey('');
    setConnectionName('');
    setConnectionStatus('idle');
    setConnectionMessage('');
    setIsCreating(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateLocal = () => {
    handleClose();
    onCreateLocal();
  };

  const testConnection = async () => {
    if (!host || !username || !token) return;

    setConnectionStatus('testing');
    setConnectionMessage('Testing connection...');

    try {
      const response = await terminalsApi.testSSH(
        {
          host,
          port: parseInt(port, 10) || 22,
          username,
          password: authMethod === 'password' ? password : undefined,
          privateKey: authMethod === 'key' ? privateKey : undefined,
        },
        token
      );

      if (response.success && response.data?.connected) {
        setConnectionStatus('success');
        setConnectionMessage(response.data.serverInfo || 'Connection successful!');
      } else {
        setConnectionStatus('error');
        setConnectionMessage(response.data?.error || response.error?.toString() || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleCreateSSH = async () => {
    if (!host || !username || !token) return;

    setIsCreating(true);

    try {
      const response = await terminalsApi.createSSH(
        {
          name: connectionName || `${username}@${host}`,
          host,
          port: parseInt(port, 10) || 22,
          username,
          password: authMethod === 'password' ? password : undefined,
          privateKey: authMethod === 'key' ? privateKey : undefined,
        },
        token
      );

      if (response.success && response.data) {
        // Call the callback with the config
        onCreateSSH({
          host,
          port: parseInt(port, 10) || 22,
          username,
          password: authMethod === 'password' ? password : undefined,
          privateKey: authMethod === 'key' ? privateKey : undefined,
          name: connectionName || `${username}@${host}`,
        });
        handleClose();
      } else {
        setConnectionStatus('error');
        setConnectionMessage(
          Array.isArray(response.error)
            ? response.error.map((e: any) => e.message).join(', ')
            : response.error?.toString() || 'Failed to create SSH terminal'
        );
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : 'Failed to create SSH terminal');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const canTest = host && username && (authMethod === 'password' ? password : privateKey);
  const canConnect = connectionStatus === 'success';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-100'
        )}
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: isDark ? '#fff' : '#1a1a1a' }}
          >
            {terminalType === 'ssh' ? 'SSH Connection' : 'Create Terminal'}
          </h2>
          <button
            onClick={handleClose}
            className={cn(
              'p-2 rounded-lg transition-colors duration-75',
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
            )}
          >
            <X size={20} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!terminalType ? (
            /* Terminal type selection */
            <div className="space-y-4">
              <p
                className="text-sm mb-4"
                style={{ color: isDark ? '#888' : '#666' }}
              >
                Choose the type of terminal to create:
              </p>

              {/* Local terminal */}
              <button
                onClick={() => handleCreateLocal()}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-75 text-left',
                  'hover:border-primary hover:bg-primary/5',
                  isDark ? 'border-gray-700' : 'border-gray-200'
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
                >
                  <Terminal size={24} className="text-primary" />
                </div>
                <div>
                  <h3
                    className="font-medium"
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    Local Terminal
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: isDark ? '#888' : '#666' }}
                  >
                    Create a terminal on this server
                  </p>
                </div>
              </button>

              {/* SSH terminal */}
              <button
                onClick={() => setTerminalType('ssh')}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-75 text-left',
                  'hover:border-primary hover:bg-primary/5',
                  isDark ? 'border-gray-700' : 'border-gray-200'
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
                >
                  <Server size={24} className="text-orange-500" />
                </div>
                <div>
                  <h3
                    className="font-medium"
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    SSH Connection
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: isDark ? '#888' : '#666' }}
                  >
                    Connect to a remote server via SSH
                  </p>
                </div>
              </button>
            </div>
          ) : (
            /* SSH form */
            <div className="space-y-4">
              {/* Connection name */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Connection Name (optional)
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder="My Server"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                    'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                  style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                />
              </div>

              {/* Host and Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Host *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => {
                      setHost(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="192.168.1.1 or server.com"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Port
                  </label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => {
                      setPort(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="22"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setConnectionStatus('idle');
                  }}
                  placeholder="root"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm font-mono',
                    isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                    'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                  style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                />
              </div>

              {/* Auth method toggle */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Authentication
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAuthMethod('password');
                      setConnectionStatus('idle');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      authMethod === 'password'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color: authMethod !== 'password' ? (isDark ? '#ccc' : '#444') : undefined,
                    }}
                  >
                    <Key size={16} />
                    Password
                  </button>
                  <button
                    onClick={() => {
                      setAuthMethod('key');
                      setConnectionStatus('idle');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      authMethod === 'key'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color: authMethod !== 'key' ? (isDark ? '#ccc' : '#444') : undefined,
                    }}
                  >
                    <Key size={16} />
                    Private Key
                  </button>
                </div>
              </div>

              {/* Password or Private Key */}
              {authMethod === 'password' ? (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setConnectionStatus('idle');
                      }}
                      placeholder="••••••••"
                      className={cn(
                        'w-full px-3 py-2 pr-10 rounded-lg text-sm font-mono',
                        isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                        'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                      style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    >
                      {showPassword ? (
                        <EyeOff size={16} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
                      ) : (
                        <Eye size={16} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Private Key *
                  </label>
                  <textarea
                    value={privateKey}
                    onChange={(e) => {
                      setPrivateKey(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    rows={4}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm font-mono',
                      isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                </div>
              )}

              {/* Connection status message */}
              {connectionStatus !== 'idle' && (
                <div
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg text-sm',
                    connectionStatus === 'testing' && (isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'),
                    connectionStatus === 'success' && (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'),
                    connectionStatus === 'error' && (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                  )}
                >
                  {connectionStatus === 'testing' && <Loader2 size={16} className="animate-spin" />}
                  {connectionStatus === 'success' && <CheckCircle size={16} />}
                  {connectionStatus === 'error' && <AlertCircle size={16} />}
                  <span>{connectionMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setTerminalType(null)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                    isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  )}
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Back
                </button>
                <button
                  onClick={testConnection}
                  disabled={!canTest || connectionStatus === 'testing'}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                    isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-black/10 hover:bg-black/15',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  {connectionStatus === 'testing' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                <button
                  onClick={handleCreateSSH}
                  disabled={!canConnect || isCreating}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-75',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isCreating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
