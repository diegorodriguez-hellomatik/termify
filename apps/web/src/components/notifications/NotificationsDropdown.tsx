'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Share2,
  ShieldAlert,
  Info,
  X,
  Users,
  UserPlus,
  UserMinus,
  Shield,
  ListTodo,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationsApi, Notification, NotificationType } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationsSocket } from '@/hooks/useNotificationsSocket';
import { toast } from '@/hooks/useToast';

const notificationIcons: Record<NotificationType, typeof Bell> = {
  TERMINAL_SHARED: Share2,
  TERMINAL_SHARE_REVOKED: ShieldAlert,
  TERMINAL_SHARE_UPDATED: Share2,
  SYSTEM: Info,
  TEAM_INVITE: Users,
  TEAM_MEMBER_JOINED: UserPlus,
  TEAM_MEMBER_LEFT: UserMinus,
  TEAM_ROLE_CHANGED: Shield,
  TASK_ASSIGNED: ListTodo,
  TASK_UNASSIGNED: ListTodo,
  TASK_STATUS_CHANGED: ListTodo,
  TASK_DUE_SOON: Clock,
  TASK_OVERDUE: AlertTriangle,
  // Push notification types
  TERMINAL_CRASHED: ShieldAlert,
  SSH_CONNECTION_FAILED: ShieldAlert,
  VIEWER_JOINED: UserPlus,
  VIEWER_LEFT: UserMinus,
  COMMAND_COMPLETED: Check,
};

interface NotificationsDropdownProps {
  showLabel?: boolean;
}

export function NotificationsDropdown({ showLabel = false }: NotificationsDropdownProps) {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track if component is mounted for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate dropdown position when opening or when content changes
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const dropdownWidth = 320;

        // Get actual dropdown height or use estimate
        const actualHeight = dropdownRef.current?.offsetHeight || 200;
        const dropdownHeight = Math.min(actualHeight, 400);

        // Find the sidebar (the dropdown should appear to the right of the sidebar)
        const sidebar = buttonRef.current.closest('[data-sidebar]') || buttonRef.current.closest('nav') || buttonRef.current.closest('aside');
        const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : rect.right;

        // Position to the right of the sidebar
        let left = sidebarRight + 8;

        // Position dropdown so it aligns near the button vertically
        // Start from button's top, then adjust if needed
        let top = rect.top - 20;

        // Ensure dropdown stays within viewport
        if (top < 10) top = 10;
        if (top + dropdownHeight > window.innerHeight - 10) {
          top = window.innerHeight - dropdownHeight - 10;
        }

        // If dropdown would go off-screen to the right, position it to the left of the button
        if (left + dropdownWidth > window.innerWidth - 10) {
          left = rect.left - dropdownWidth - 8;
        }

        setDropdownPosition({ top, left });
      };

      // Initial positioning
      updatePosition();

      // Update after a short delay to account for content rendering
      const timer = setTimeout(updatePosition, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, notifications.length, loading]);

  // Real-time notifications via WebSocket
  const handleNewNotification = useCallback((notification: Notification) => {
    // Filter out notifications triggered by the current user
    const actorId = (notification.metadata as any)?.actorId || (notification.metadata as any)?.viewerId;
    const currentUserId = session?.user?.id;

    // Skip self-notifications for viewer/action events
    const selfNotificationTypes: NotificationType[] = [
      'VIEWER_JOINED',
      'VIEWER_LEFT',
      'COMMAND_COMPLETED',
    ];

    if (currentUserId && actorId === currentUserId && selfNotificationTypes.includes(notification.type)) {
      console.log('[Notifications] Skipping self-notification:', notification.type);
      return; // Don't show notification for own actions
    }

    // Add to notifications list
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Determine toast variant based on notification type
    let variant: 'default' | 'destructive' | 'success' | 'warning' | 'info' = 'default';
    if (notification.type.includes('JOINED') || notification.type.includes('COMPLETED')) {
      variant = 'success';
    } else if (notification.type.includes('LEFT') || notification.type.includes('REVOKED')) {
      variant = 'warning';
    } else if (notification.type.includes('FAILED') || notification.type.includes('CRASHED') || notification.type.includes('OVERDUE')) {
      variant = 'destructive';
    } else if (notification.type.includes('SHARED') || notification.type.includes('INVITE')) {
      variant = 'info';
    }

    // Show toast notification
    toast({
      title: notification.title,
      description: notification.message,
      variant,
    });
  }, [session?.user?.id]);

  useNotificationsSocket({
    token: session?.accessToken || null,
    onNotification: handleNewNotification,
  });

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
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedButton && !clickedDropdown) {
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

  const dropdownContent = isOpen && mounted && (
    <div
      ref={dropdownRef}
      className="fixed w-80 max-h-[400px] overflow-hidden bg-popover border border-border rounded-lg shadow-xl z-[100] flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
      }}
    >
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
                    notification.type === 'SYSTEM' && 'bg-muted text-muted-foreground',
                    notification.type === 'TEAM_INVITE' && 'bg-purple-500/10 text-purple-500',
                    notification.type === 'TEAM_MEMBER_JOINED' && 'bg-green-500/10 text-green-500',
                    notification.type === 'TEAM_MEMBER_LEFT' && 'bg-orange-500/10 text-orange-500',
                    notification.type === 'TEAM_ROLE_CHANGED' && 'bg-blue-500/10 text-blue-500',
                    notification.type === 'TASK_ASSIGNED' && 'bg-indigo-500/10 text-indigo-500',
                    notification.type === 'TASK_UNASSIGNED' && 'bg-gray-500/10 text-gray-500',
                    notification.type === 'TASK_STATUS_CHANGED' && 'bg-cyan-500/10 text-cyan-500',
                    notification.type === 'TASK_DUE_SOON' && 'bg-yellow-500/10 text-yellow-500',
                    notification.type === 'TASK_OVERDUE' && 'bg-red-500/10 text-red-500',
                    notification.type === 'TERMINAL_CRASHED' && 'bg-red-500/10 text-red-500',
                    notification.type === 'SSH_CONNECTION_FAILED' && 'bg-red-500/10 text-red-500',
                    notification.type === 'VIEWER_JOINED' && 'bg-green-500/10 text-green-500',
                    notification.type === 'VIEWER_LEFT' && 'bg-orange-500/10 text-orange-500',
                    notification.type === 'COMMAND_COMPLETED' && 'bg-green-500/10 text-green-500'
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
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={cn(
          'relative flex items-center gap-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
          showLabel ? 'px-3 py-2.5 w-full' : 'w-12 h-12 justify-center'
        )}
        onClick={() => setIsOpen(!isOpen)}
        title={!showLabel ? 'Notifications' : undefined}
      >
        <div className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {showLabel && <span className="text-sm">Notifications</span>}
      </button>

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
