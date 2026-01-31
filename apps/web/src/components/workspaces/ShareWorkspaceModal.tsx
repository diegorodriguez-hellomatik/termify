'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Link2,
  Users,
  Copy,
  Check,
  Trash2,
  Loader2,
  Eye,
  Edit3,
  Mail,
  Globe,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { workspaceShareApi, WorkspaceShare, SharePermission } from '@/lib/api';

interface ShareWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  isDark: boolean;
  token?: string;
}

type Tab = 'link' | 'people';

export function ShareWorkspaceModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  isDark,
  token,
}: ShareWorkspaceModalProps) {
  const [tab, setTab] = useState<Tab>('link');
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link share state
  const [linkShare, setLinkShare] = useState<WorkspaceShare | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [linkPermission, setLinkPermission] = useState<SharePermission>('VIEW');
  const [copied, setCopied] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);

  // Email share state
  const [email, setEmail] = useState('');
  const [emailPermission, setEmailPermission] = useState<SharePermission>('VIEW');
  const [sharingEmail, setSharingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await workspaceShareApi.getShares(workspaceId, token);
      if (response.success && response.data) {
        setShares(response.data.shares);
        // Find existing link share
        const existing = response.data.shares.find((s) => s.type === 'LINK');
        if (existing) {
          setLinkShare(existing);
          setLinkPermission(existing.permission);
          setShareUrl(
            `${window.location.origin}/share/workspace/${existing.shareToken}`
          );
        }
      } else {
        setError(response.error?.toString() || 'Failed to load shares');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, loadShares]);

  const handleCreateOrUpdateLink = async () => {
    if (!token) return;
    setCreatingLink(true);

    try {
      const response = await workspaceShareApi.createShareLink(
        workspaceId,
        { permission: linkPermission },
        token
      );
      if (response.success && response.data) {
        setLinkShare(response.data.share);
        setShareUrl(response.data.shareUrl);
        loadShares();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email) return;

    setSharingEmail(true);
    setEmailError(null);

    try {
      const response = await workspaceShareApi.shareWithEmail(
        workspaceId,
        { email, permission: emailPermission },
        token
      );
      if (response.success) {
        setEmail('');
        loadShares();
      } else {
        setEmailError(
          Array.isArray(response.error)
            ? response.error.map((e: any) => e.message).join(', ')
            : response.error?.toString() || 'Failed to share'
        );
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharingEmail(false);
    }
  };

  const handleUpdateSharePermission = async (
    shareId: string,
    permission: SharePermission
  ) => {
    if (!token) return;

    try {
      const response = await workspaceShareApi.updateShare(
        workspaceId,
        shareId,
        { permission },
        token
      );
      if (response.success) {
        loadShares();
      }
    } catch (err) {
      console.error('Failed to update share:', err);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!token) return;

    try {
      const response = await workspaceShareApi.deleteShare(workspaceId, shareId, token);
      if (response.success) {
        if (linkShare?.id === shareId) {
          setLinkShare(null);
          setShareUrl('');
        }
        loadShares();
      }
    } catch (err) {
      console.error('Failed to revoke share:', err);
    }
  };

  const emailShares = shares.filter((s) => s.type === 'EMAIL');

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden',
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
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: isDark ? '#fff' : '#1a1a1a' }}
            >
              Share Workspace
            </h2>
            <p
              className="text-sm mt-0.5"
              style={{ color: isDark ? '#888' : '#666' }}
            >
              {workspaceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-colors duration-75',
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
            )}
          >
            <X size={20} className={isDark ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b"
          style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
        >
          <button
            onClick={() => setTab('link')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              tab === 'link'
                ? 'border-b-2 border-primary text-primary'
                : isDark
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Link2 size={16} />
            Link
          </button>
          <button
            onClick={() => setTab('people')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              tab === 'people'
                ? 'border-b-2 border-primary text-primary'
                : isDark
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Users size={16} />
            People
            {emailShares.length > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: isDark ? '#333' : '#e0e0e0',
                  color: isDark ? '#ccc' : '#666',
                }}
              >
                {emailShares.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && !shares.length ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: isDark ? '#888' : '#666' }}
              />
            </div>
          ) : error ? (
            <div
              className="p-4 rounded-lg text-sm"
              style={{
                backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                color: isDark ? '#f87171' : '#dc2626',
              }}
            >
              {error}
            </div>
          ) : tab === 'link' ? (
            /* Link Tab */
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
                >
                  <Globe size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    Share via Link
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: isDark ? '#888' : '#666' }}
                  >
                    Anyone with the link can access this workspace
                  </p>
                </div>
              </div>

              {/* Permission selector */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: isDark ? '#ccc' : '#444' }}
                >
                  Permission
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLinkPermission('VIEW')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      linkPermission === 'VIEW'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color:
                        linkPermission !== 'VIEW'
                          ? isDark
                            ? '#ccc'
                            : '#444'
                          : undefined,
                    }}
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => setLinkPermission('CONTROL')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-75',
                      linkPermission === 'CONTROL'
                        ? 'bg-primary text-primary-foreground'
                        : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                    )}
                    style={{
                      color:
                        linkPermission !== 'CONTROL'
                          ? isDark
                            ? '#ccc'
                            : '#444'
                          : undefined,
                    }}
                  >
                    <Edit3 size={16} />
                    Control
                  </button>
                </div>
              </div>

              {/* Share URL */}
              {linkShare && shareUrl ? (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-2 p-3 rounded-lg"
                    style={{
                      backgroundColor: isDark ? '#262626' : '#f5f5f5',
                    }}
                  >
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 bg-transparent text-sm font-mono outline-none"
                      style={{ color: isDark ? '#ccc' : '#444' }}
                    />
                    <button
                      onClick={handleCopyLink}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
                      )}
                    >
                      {copied ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy
                          size={16}
                          className={isDark ? 'text-gray-400' : 'text-gray-600'}
                        />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {linkShare.permission !== linkPermission && (
                      <button
                        onClick={handleCreateOrUpdateLink}
                        disabled={creatingLink}
                        className={cn(
                          'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          'bg-primary text-primary-foreground hover:bg-primary/90',
                          'disabled:opacity-50'
                        )}
                      >
                        {creatingLink ? (
                          <Loader2 size={16} className="animate-spin mx-auto" />
                        ) : (
                          'Update Permission'
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRevokeShare(linkShare.id)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      )}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCreateOrUpdateLink}
                  disabled={creatingLink}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-50'
                  )}
                >
                  {creatingLink ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Creating link...
                    </span>
                  ) : (
                    'Create Share Link'
                  )}
                </button>
              )}
            </div>
          ) : (
            /* People Tab */
            <div className="space-y-4">
              {/* Add by email form */}
              <form onSubmit={handleShareByEmail} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isDark ? '#333' : '#f0f0f0' }}
                  >
                    <Mail size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium"
                      style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                    >
                      Share with People
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: isDark ? '#888' : '#666' }}
                    >
                      Invite specific users by email
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm',
                      isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  />
                  <select
                    value={emailPermission}
                    onChange={(e) =>
                      setEmailPermission(e.target.value as SharePermission)
                    }
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm',
                      isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-black/5 border-black/10',
                      'border focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                    style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                  >
                    <option value="VIEW">View</option>
                    <option value="CONTROL">Control</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!email || sharingEmail}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {sharingEmail ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </button>
                </div>

                {emailError && (
                  <p className="text-sm text-red-500">{emailError}</p>
                )}
              </form>

              {/* Shared with list */}
              {emailShares.length > 0 && (
                <div
                  className="border-t pt-4"
                  style={{ borderColor: isDark ? '#333' : '#e0e0e0' }}
                >
                  <p
                    className="text-sm font-medium mb-3"
                    style={{ color: isDark ? '#ccc' : '#444' }}
                  >
                    Shared with
                  </p>
                  <div className="space-y-2">
                    {emailShares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          backgroundColor: isDark ? '#262626' : '#f5f5f5',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isDark ? '#444' : '#ddd',
                          }}
                        >
                          {share.sharedWith?.image ? (
                            <img
                              src={share.sharedWith.image}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <User
                              size={16}
                              className={
                                isDark ? 'text-gray-400' : 'text-gray-600'
                              }
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                          >
                            {share.sharedWith?.name ||
                              share.sharedEmail ||
                              'Unknown'}
                          </p>
                          <p
                            className="text-xs truncate"
                            style={{ color: isDark ? '#888' : '#666' }}
                          >
                            {share.sharedWith?.email || share.sharedEmail}
                          </p>
                        </div>
                        <select
                          value={share.permission}
                          onChange={(e) =>
                            handleUpdateSharePermission(
                              share.id,
                              e.target.value as SharePermission
                            )
                          }
                          className={cn(
                            'px-2 py-1 rounded text-xs',
                            isDark
                              ? 'bg-white/5 border-white/10'
                              : 'bg-white border-gray-200',
                            'border focus:outline-none'
                          )}
                          style={{ color: isDark ? '#ccc' : '#444' }}
                        >
                          <option value="VIEW">View</option>
                          <option value="CONTROL">Control</option>
                        </select>
                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          className={cn(
                            'p-1.5 rounded transition-colors',
                            'hover:bg-red-500/10 text-red-500'
                          )}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
