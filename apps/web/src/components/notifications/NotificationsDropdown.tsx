'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Bell, Check, CheckCheck, Trash2, Share2, ShieldAlert, Info, X,
  Users, UserPlus, UserMinus, Shield, ListChecks, Clock, AlertCircle,
  Terminal, Wifi, Eye, PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationsApi, Notification, NotificationType } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const notificationIcons: Record<NotificationType, typeof Bell> = {
  TERMINAL_SHARED: Share2,
  TERMINAL_SHARE_REVOKED: ShieldAlert,
  TERMINAL_SHARE_UPDATED: Share2,
  SYSTEM: Info,
  TEAM_INVITE: UserPlus,
  TEAM_MEMBER_JOINED: UserPlus,
  TEAM_MEMBER_LEFT: UserMinus,
  TEAM_ROLE_CHANGED: Shield,
  TASK_ASSIGNED: ListChecks,
  TASK_UNASSIGNED: ListChecks,
  TASK_STATUS_CHANGED: ListChecks,
  TASK_DUE_SOON: Clock,
  TASK_OVERDUE: AlertCircle,
  TERMINAL_CRASHED: AlertCircle,
  SSH_CONNECTION_FAILED: Wifi,
  VIEWER_JOINED: Eye,
  VIEWER_LEFT: Eye,
  COMMAND_COMPLETED: PlayCircle,
};

export function NotificationsDropdown() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    try {
      const response = await notificationsApi.list(session.accessToken);
      if (response.success && response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const response = await notificationsApi.getUnreadCount(session.accessToken);
      if (response.success && response.data) {
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [session?.accessToken]);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!session?.accessToken) return;

    try {
      await notificationsApi.markAsRead([notificationId], session.accessToken);
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!session?.accessToken) return;

    try {
      await notificationsApi.markAllAsRead(session.accessToken);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!session?.accessToken) return;

    try {
      await notificationsApi.delete(notificationId, session.accessToken);
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!session?.accessToken) return;

    try {
      await notificationsApi.deleteAll(session.accessToken);
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative w-10 h-10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[400px] overflow-hidden bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheck size={14} className="mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                <Bell size={24} className="mx-auto mb-2 opacity-50" />
                No notifications
              </div>
            ) : (
              <>
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || Bell;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'relative flex gap-3 px-3 py-3 hover:bg-muted/50 border-b border-border last:border-b-0',
                        !notification.read && 'bg-primary/5'
                      )}
                    >
                      <div className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                        notification.type === 'TERMINAL_SHARED' && 'bg-green-500/10 text-green-500',
                        notification.type === 'TERMINAL_SHARE_REVOKED' && 'bg-red-500/10 text-red-500',
                        notification.type === 'TERMINAL_SHARE_UPDATED' && 'bg-blue-500/10 text-blue-500',
                        notification.type === 'SYSTEM' && 'bg-muted text-muted-foreground'
                      )}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMarkAsRead(notification.id)}
                                title="Mark as read"
                              >
                                <Check size={12} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(notification.id)}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border">
              <button
                className="w-full px-3 py-2 text-center text-xs text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                onClick={handleDeleteAll}
              >
                <Trash2 size={12} />
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
